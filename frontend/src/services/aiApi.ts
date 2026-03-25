export interface SSEEvent {
  type: string
  data: Record<string, unknown>
}

const API_ORIGIN = import.meta.env.DEV ? 'http://localhost:8000' : ''

async function* parseSSE(response: Response): AsyncGenerator<SSEEvent> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6)
          try {
            const data = JSON.parse(raw)
            yield { type: currentEvent || 'message', data }
          } catch {
            yield { type: currentEvent || 'message', data: { content: raw } }
          }
          currentEvent = ''
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function sseRequest(
  path: string,
  body?: Record<string, unknown>,
): { stream: AsyncGenerator<SSEEvent>; abort: () => void } {
  const controller = new AbortController()
  const url = `${API_ORIGIN}${path}`

  const fetchPromise = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  })

  async function* generator(): AsyncGenerator<SSEEvent> {
    const response = await fetchPromise
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Request failed: ${response.status} - ${text}`)
    }
    yield* parseSSE(response)
  }

  return {
    stream: generator(),
    abort: () => controller.abort(),
  }
}

export async function planStructure(
  paperId: string,
): Promise<{
  sections: Array<{ id: string; title: string; order: number; status: string }>
}> {
  const res = await fetch(`${API_ORIGIN}/api/papers/${paperId}/plan-structure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Structure planning failed: ${res.status} - ${text}`)
  }
  return res.json()
}

export async function planInstructions(
  paperId: string,
): Promise<{
  sections: Array<{ id: string; title: string; ai_instruction: string; status: string }>
}> {
  const res = await fetch(`${API_ORIGIN}/api/papers/${paperId}/plan-instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Instruction planning failed: ${res.status} - ${text}`)
  }
  return res.json()
}

export function streamGenerateSection(sectionId: string) {
  return sseRequest(`/api/sections/${sectionId}/generate`)
}

export function streamPolishSection(
  sectionId: string,
  action: string,
  instruction?: string,
) {
  return sseRequest(`/api/sections/${sectionId}/polish`, {
    action,
    instruction: instruction || '',
  })
}

export function streamGenerateAll(paperId: string) {
  return sseRequest(`/api/papers/${paperId}/generate-all`)
}

export async function extractKeywords(paperId: string): Promise<{ keywords: string }> {
  const res = await fetch(`${API_ORIGIN}/api/papers/${paperId}/extract-keywords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || '关键词提取失败')
  }
  return res.json()
}

export function streamChat(
  paperId: string,
  sectionId: string,
  messages: Array<{ role: string; content: string }>,
) {
  return sseRequest(`/api/papers/${paperId}/chat`, {
    section_id: sectionId,
    messages,
  })
}
