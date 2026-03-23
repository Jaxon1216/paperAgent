/**
 * Count words in a Markdown string.
 * Chinese/CJK characters count as 1 word each; consecutive Latin/digit tokens count as 1 word.
 * Markdown syntax (headings, emphasis, links, images, code fences, etc.) is stripped first.
 */
export function countWords(md: string | undefined | null): number {
  if (!md) return 0

  let text = md
    // code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // images & links
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => m.replace(/\[([^\]]*)\]\([^)]*\)/, '$1'))
    // headings, hr, emphasis, bold
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // html tags
    .replace(/<[^>]+>/g, '')
    // blockquotes / list markers
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-+*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')

  text = text.trim()
  if (!text) return 0

  // CJK ranges: main CJK Unified Ideographs + common extensions
  const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g
  const cjkCount = (text.match(CJK) || []).length

  // Remove CJK chars, then count remaining Latin/digit word tokens
  const latin = text.replace(CJK, ' ').trim()
  const latinCount = latin ? latin.split(/\s+/).filter(Boolean).length : 0

  return cjkCount + latinCount
}
