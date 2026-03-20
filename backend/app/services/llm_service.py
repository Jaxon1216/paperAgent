import json
from typing import AsyncGenerator

import litellm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import Setting

LLM_SETTINGS_KEY = "llm_settings"

SYSTEM_PROMPT = (
    "你是一位专业的学术论文写作助手。请使用正式的学术语言撰写内容，"
    "确保逻辑严谨、论述清晰、用词准确。输出纯 Markdown 格式，"
    "数学公式使用 $...$ 或 $$...$$ 语法。不要输出与正文无关的元信息。\n\n"
    "重要规则：\n"
    "- 绝对不要输出章节标题行（# 标题），标题由系统自动添加\n"
    "- 第一层子标题必须使用 ##，再下一层使用 ###，以此类推。不要跳级（如直接用 ### 而不先用 ##）\n"
    "- 子标题不要添加编号（编号由排版模板自动生成）\n"
    "- 绝对不要自行编造或生成参考文献条目\n"
    "- 如果提供了参考文献列表，使用方括号序号引用，如 [1]、[2]\n"
    "- 不要在末尾输出关键词建议或参考文献推荐\n"
    "- 只输出纯正文内容"
)

SYSTEM_PROMPT_EN = (
    "You are a professional academic paper writing assistant. "
    "Write in formal academic English with rigorous logic and precise terminology. "
    "Output pure Markdown. Use $...$ or $$...$$ for math formulas.\n\n"
    "Important rules:\n"
    "- NEVER output the section title heading (# Title) — it is added automatically\n"
    "- First-level sub-headings MUST use ## , next level ###. Never skip levels (e.g. using ### without ## first)\n"
    "- Do NOT add numbering to sub-headings — numbering is added by the template\n"
    "- NEVER fabricate or generate reference entries\n"
    "- If a reference list is provided, cite using bracket numbers like [1], [2]\n"
    "- Do NOT output keyword suggestions or reference recommendations"
)

STRUCTURE_PROMPT = """\
你是论文结构规划师。根据以下信息，规划最优的章节结构。

论文标题：{title}
写作要求：{requirements}
目标总字数：{target_words} 字
当前章节（可能为空，你可以增删改）：
{sections_desc}

规则：
- 不要包含「参考文献」章节（参考文献由用户单独管理）
- 通常应包含「摘要」和「引言」
- 根据论文类型和要求设计合理的章节结构
- 数组顺序即章节顺序
- 标题只写名称，不要添加编号（如"引言"而非"一、引言"或"1. 引言"）

请输出一个 JSON 数组，每项只包含 title：
```json
[{{"title": "章节标题"}}]
```
只输出 JSON，不要其他内容。"""

INSTRUCTION_PROMPT = """\
你是论文写作指导师。根据以下信息，为每个章节生成详细的写作指令。

论文标题：{title}
写作要求：{requirements}
目标总字数：{target_words} 字
章节结构：
{sections_desc}

请输出一个 JSON 数组，格式：
```json
[
  {{"title": "章节标题", "instruction": "详细写作指令（要点、字数、风格）", "target_words": 数字}}
]
```
只输出 JSON，不要其他内容。"""

SECTION_GENERATE_PROMPT = """\
请撰写论文章节「{title}」的内容。

写作指令：{instruction}
目标字数：约 {target_words} 字

{context}
{references_context}
重要规则：
- 直接输出正文内容，绝对不要输出章节标题行（标题由系统自动添加）
- 子标题使用 ## 和 ### 标记，不要手动添加编号（编号由排版模板自动生成）
- 不要编造参考文献，如有参考文献列表则用 [序号] 引用
- 不要在末尾输出关键词建议或参考文献推荐"""

ABSTRACT_GENERATE_PROMPT = """\
请撰写论文的「{title}」部分。

写作指令：{instruction}
目标字数：约 {target_words} 字

以下是论文各章节的内容摘要，请据此撰写一份准确、全面的摘要：
{full_paper_summary}

重要规则：
- 直接输出摘要正文内容，绝对不要输出标题行
- 摘要应概括论文的研究目的、方法、主要发现和结论
- 末尾附 3-5 个关键词，格式如：**关键词：** 关键词1、关键词2、关键词3
- 不要编造参考文献条目"""

KEYWORD_PROMPT = """\
根据以下论文信息，推荐约 15 个参考文献搜索关键词，按与论文的相关性从高到低排序。

论文标题：{title}
写作要求：{requirements}

论文内容摘要：
{compressed_content}

直接输出关键词列表，每行一个，不要编号，不要解释，不要分类。中英文关键词均可。"""

ADD_CITATIONS_PROMPT = """\
请在以下论文章节内容中的合适位置添加参考文献引用标注。

章节内容：
{content}

参考文献列表：
{references}

规则：
- 在论述与某条参考文献相关的位置插入 [序号] 标注，如 [1]、[2]
- 只使用上面列出的参考文献序号，绝对不要编造新文献
- 不是每条参考文献都必须引用，只在内容确实相关时添加
- 保持原文内容和结构不变，只在适当位置插入引用标注
- 输出完整的修改后章节内容"""


def build_add_citations_messages(
    content: str,
    references: list[str],
    language: str = "zh",
) -> list[dict]:
    refs_text = "\n".join(f"[{i+1}] {ref}" for i, ref in enumerate(references))
    return [
        build_system_message(language),
        {
            "role": "user",
            "content": ADD_CITATIONS_PROMPT.format(
                content=content,
                references=refs_text,
            ),
        },
    ]


POLISH_PROMPTS = {
    "polish": "请润色以下学术论文段落，保持原意不变，优化学术表达和语言流畅度：\n\n{content}",
    "expand": "请扩写以下段落，补充更多细节、论证和分析，目标扩展到原文的 1.5-2 倍长度：\n\n{content}",
    "compress": "请将以下段落精简压缩到原文的一半左右长度，保留核心信息和关键论点：\n\n{content}",
    "rewrite": "请重写以下段落，保留核心观点但完全重新组织语言和结构：\n\n{content}",
    "format_refs": (
        "请将以下参考文献内容规范化为标准学术引用格式。\n"
        "规则：\n"
        "- 期刊论文：[序号] 作者.文章标题[J].期刊名,年份(期号).\n"
        "- 专著：[序号] 作者.书名[M].出版地:出版社,年份.\n"
        "- 学位论文：[序号] 作者.论文题目[D].学校,年份.\n"
        "- 只规范格式，不要添加用户未提供的文献\n"
        "- 按引用顺序编号\n\n{content}"
    ),
    "custom": "{instruction}\n\n原文：\n{content}",
}

ABSTRACT_TITLES = {"摘要", "Abstract", "abstract"}


def is_abstract(title: str) -> bool:
    return title.strip() in ABSTRACT_TITLES


async def get_llm_settings(db: AsyncSession) -> dict:
    result = await db.execute(select(Setting).where(Setting.key == LLM_SETTINGS_KEY))
    setting = result.scalar_one_or_none()
    if not setting:
        raise ValueError("LLM 未配置，请先在设置页面填写 API Key 和模型信息")
    data = json.loads(setting.value)
    if not data.get("api_key"):
        raise ValueError("API Key 未设置，请先在设置页面配置")
    return data


async def chat(messages: list[dict], db: AsyncSession) -> str:
    settings = await get_llm_settings(db)
    kwargs: dict = {
        "model": settings["model"],
        "messages": messages,
        "api_key": settings["api_key"],
    }
    if settings.get("base_url"):
        kwargs["api_base"] = settings["base_url"]

    response = await litellm.acompletion(**kwargs)
    return response.choices[0].message.content or ""


async def stream_chat(messages: list[dict], db: AsyncSession) -> AsyncGenerator[str, None]:
    settings = await get_llm_settings(db)
    kwargs: dict = {
        "model": settings["model"],
        "messages": messages,
        "api_key": settings["api_key"],
        "stream": True,
    }
    if settings.get("base_url"):
        kwargs["api_base"] = settings["base_url"]

    response = await litellm.acompletion(**kwargs)
    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


def build_system_message(language: str = "zh") -> dict:
    prompt = SYSTEM_PROMPT if language == "zh" else SYSTEM_PROMPT_EN
    return {"role": "system", "content": prompt}


def build_structure_messages(
    title: str,
    requirements: str,
    target_words: int,
    sections: list[dict],
    language: str = "zh",
) -> list[dict]:
    sections_desc = "\n".join(
        f"  {i+1}. {s['title']}" for i, s in enumerate(sections)
    ) if sections else "  （暂无章节）"
    return [
        build_system_message(language),
        {
            "role": "user",
            "content": STRUCTURE_PROMPT.format(
                title=title,
                requirements=requirements,
                target_words=target_words,
                sections_desc=sections_desc,
            ),
        },
    ]


def build_instruction_messages(
    title: str,
    requirements: str,
    target_words: int,
    sections: list[dict],
    language: str = "zh",
) -> list[dict]:
    sections_desc = "\n".join(
        f"  {i+1}. {s['title']}" for i, s in enumerate(sections)
    )
    return [
        build_system_message(language),
        {
            "role": "user",
            "content": INSTRUCTION_PROMPT.format(
                title=title,
                requirements=requirements,
                target_words=target_words,
                sections_desc=sections_desc,
            ),
        },
    ]


def _format_references_context(references: list[str] | None) -> str:
    if not references:
        return ""
    items = "\n".join(f"[{i+1}] {ref}" for i, ref in enumerate(references))
    return f"可用的参考文献（请在正文中用 [序号] 格式引用）：\n{items}"


def build_section_messages(
    title: str,
    instruction: str,
    target_words: int,
    prev_content: str | None = None,
    full_paper_summary: str | None = None,
    references: list[str] | None = None,
    language: str = "zh",
) -> list[dict]:
    refs_ctx = _format_references_context(references)

    if is_abstract(title) and full_paper_summary:
        return [
            build_system_message(language),
            {
                "role": "user",
                "content": ABSTRACT_GENERATE_PROMPT.format(
                    title=title,
                    instruction=instruction,
                    target_words=target_words,
                    full_paper_summary=full_paper_summary,
                ),
            },
        ]

    context = ""
    if prev_content:
        context = f"上一章节内容摘要：\n{prev_content[:800]}"

    return [
        build_system_message(language),
        {
            "role": "user",
            "content": SECTION_GENERATE_PROMPT.format(
                title=title,
                instruction=instruction,
                target_words=target_words,
                context=context,
                references_context=refs_ctx,
            ),
        },
    ]


def build_keyword_messages(
    title: str,
    requirements: str,
    compressed_content: str,
    language: str = "zh",
) -> list[dict]:
    return [
        build_system_message(language),
        {
            "role": "user",
            "content": KEYWORD_PROMPT.format(
                title=title,
                requirements=requirements,
                compressed_content=compressed_content,
            ),
        },
    ]


def build_polish_messages(
    content: str,
    action: str,
    instruction: str = "",
    prev_content: str | None = None,
    next_content: str | None = None,
    language: str = "zh",
) -> list[dict]:
    template = POLISH_PROMPTS.get(action, POLISH_PROMPTS["custom"])
    user_content = template.format(content=content, instruction=instruction)

    context_parts = []
    if prev_content:
        context_parts.append(f"上一章节摘要：\n{prev_content[:500]}")
    if next_content:
        context_parts.append(f"下一章节摘要：\n{next_content[:500]}")
    if context_parts:
        user_content += "\n\n参考上下文：\n" + "\n\n".join(context_parts)

    return [
        build_system_message(language),
        {"role": "user", "content": user_content},
    ]


def _extract_json(text: str) -> str:
    """Strip markdown fences to find raw JSON."""
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("[") or part.startswith("{"):
                return part
    return text


def parse_coordinator_response(text: str) -> list[dict]:
    """Extract JSON array from coordinator response."""
    text = _extract_json(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end_idx = text.rfind("]")
        if start != -1 and end_idx != -1:
            return json.loads(text[start : end_idx + 1])
        return []


def parse_instruction_response(text: str) -> list[dict]:
    """Extract JSON array of section instructions."""
    text = _extract_json(text)
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "sections" in data:
            return data["sections"]
    except json.JSONDecodeError:
        start = text.find("[")
        end_idx = text.rfind("]")
        if start != -1 and end_idx != -1:
            try:
                return json.loads(text[start : end_idx + 1])
            except json.JSONDecodeError:
                pass
    return []
