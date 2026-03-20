import json
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.connection import get_db
from app.models.paper import Paper
from app.models.reference import Reference
from app.models.section import Section
from app.services.llm_service import (
    build_instruction_messages,
    build_keyword_messages,
    build_polish_messages,
    build_section_messages,
    build_structure_messages,
    build_system_message,
    chat,
    is_abstract,
    parse_coordinator_response,
    parse_instruction_response,
    stream_chat,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai"])


class PolishRequest(BaseModel):
    action: str  # polish | expand | compress | rewrite | custom
    instruction: str = ""


class ChatRequest(BaseModel):
    section_id: str = ""
    messages: list[dict]


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _sse(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _sse_response(generator):
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


async def _get_section_with_neighbors(section_id: str, db: AsyncSession):
    result = await db.execute(select(Section).where(Section.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    result = await db.execute(
        select(Section)
        .where(Section.paper_id == section.paper_id)
        .order_by(Section.order)
    )
    all_sections = result.scalars().all()

    prev_content = None
    next_content = None
    for i, s in enumerate(all_sections):
        if s.id == section.id:
            if i > 0:
                prev_content = all_sections[i - 1].content_md
            if i < len(all_sections) - 1:
                next_content = all_sections[i + 1].content_md
            break

    return section, prev_content, next_content


def _compress_section(title: str, content: str, max_chars: int = 200) -> str:
    """Compress section content to a short summary for context injection."""
    if not content:
        return ""
    text = content.strip()
    if len(text) <= max_chars:
        return f"【{title}】{text}"
    return f"【{title}】{text[:max_chars]}…"


_HEADING_NUM_RE = re.compile(
    r"^(#{1,6})\s+"
    r"(?:"
    r"\d+(?:\.\d+)*\.?\s+"           # 1. / 1.1 / 4.1.2
    r"|[一二三四五六七八九十百]+[、.．]\s*"  # 一、/ 二、
    r"|[（(]\d+[)）]\s*"              # (1) / （2）
    r")"
)


def _clean_ai_content(content: str, section_title: str) -> str:
    """Strip duplicate section title heading and numbering prefixes from AI output."""
    lines = content.split("\n")
    result = []
    title_checked = False

    for line in lines:
        stripped = line.strip()

        if not title_checked and stripped.startswith("#"):
            title_checked = True
            heading_text = stripped.lstrip("#").strip()
            cleaned = re.sub(r"^\d+(?:\.\d+)*\.?\s*", "", heading_text)
            cleaned = re.sub(r"^[一二三四五六七八九十百]+[、.．]\s*", "", cleaned)
            cleaned = re.sub(r"^[（(]\d+[)）]\s*", "", cleaned)
            if cleaned.strip() == section_title.strip() or heading_text.strip() == section_title.strip():
                continue
        elif not title_checked and stripped:
            title_checked = True

        m = _HEADING_NUM_RE.match(line)
        if m:
            line = f"{m.group(1)} {line[m.end():]}"

        result.append(line)

    return "\n".join(result)


def _clean_title(title: str) -> str:
    """Strip numbering prefixes from a section title returned by AI."""
    t = title.strip()
    t = re.sub(r"^\d+(?:\.\d+)*\.?\s*", "", t)
    t = re.sub(r"^[一二三四五六七八九十百]+[、.．]\s*", "", t)
    t = re.sub(r"^[（(]\d+[)）]\s*", "", t)
    return t.strip() or title.strip()


@router.post("/sections/{section_id}/generate")
async def generate_section(section_id: str, db: AsyncSession = Depends(get_db)):
    section, prev_content, _next_content = await _get_section_with_neighbors(section_id, db)

    result = await db.execute(select(Paper).where(Paper.id == section.paper_id))
    paper = result.scalar_one_or_none()

    all_sections_result = await db.execute(
        select(Section).where(Section.paper_id == paper.id).order_by(Section.order)
    )
    all_sections = all_sections_result.scalars().all()

    refs_result = await db.execute(
        select(Reference).where(Reference.paper_id == paper.id).order_by(Reference.order)
    )
    ref_list = [r.content for r in refs_result.scalars().all() if r.content]

    instruction = section.ai_instruction or f"撰写「{section.title}」章节"
    target_words = paper.target_words // max(1, len(all_sections)) if paper else 1000

    if is_abstract(section.title):
        summary = "\n\n".join(
            _compress_section(s.title, s.content_md or "", 300)
            for s in all_sections if not is_abstract(s.title) and s.content_md
        )
        messages = build_section_messages(
            title=section.title,
            instruction=instruction,
            target_words=target_words,
            full_paper_summary=summary if summary else None,
            references=ref_list or None,
        )
    else:
        messages = build_section_messages(
            title=section.title,
            instruction=instruction,
            target_words=target_words,
            prev_content=prev_content,
            references=ref_list or None,
        )

    section.status = "generating"
    section.updated_at = datetime.now(timezone.utc)
    await db.commit()

    section_title = section.title

    async def event_stream():
        full_content = ""
        try:
            async for chunk in stream_chat(messages, db):
                full_content += chunk
                yield _sse("chunk", {"content": chunk})

            cleaned = _clean_ai_content(full_content, section_title)
            section.content_md = cleaned
            section.status = "draft"
            section.updated_at = datetime.now(timezone.utc)
            await db.commit()
            yield _sse("done", {"content": cleaned})
        except Exception as e:
            logger.exception("Generation failed")
            section.status = "empty"
            await db.commit()
            yield _sse("error", {"message": str(e)})

    return _sse_response(event_stream())


@router.post("/sections/{section_id}/polish")
async def polish_section(
    section_id: str,
    body: PolishRequest,
    db: AsyncSession = Depends(get_db),
):
    section, prev_content, next_content = await _get_section_with_neighbors(section_id, db)

    if not section.content_md:
        raise HTTPException(status_code=400, detail="Section has no content to polish")

    messages = build_polish_messages(
        content=section.content_md,
        action=body.action,
        instruction=body.instruction,
        prev_content=prev_content,
        next_content=next_content,
    )

    section_title = section.title

    async def event_stream():
        full_content = ""
        try:
            async for chunk in stream_chat(messages, db):
                full_content += chunk
                yield _sse("chunk", {"content": chunk})

            cleaned = _clean_ai_content(full_content, section_title)
            section.content_md = cleaned
            section.status = "draft"
            section.updated_at = datetime.now(timezone.utc)
            await db.commit()
            yield _sse("done", {"content": cleaned})
        except Exception as e:
            logger.exception("Polish failed")
            yield _sse("error", {"message": str(e)})

    return _sse_response(event_stream())


@router.post("/papers/{paper_id}/plan-structure")
async def plan_structure(paper_id: str, db: AsyncSession = Depends(get_db)):
    """AI plans section structure: creates/updates/removes sections (titles only)."""
    result = await db.execute(
        select(Paper)
        .options(selectinload(Paper.sections))
        .where(Paper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    existing = sorted(paper.sections, key=lambda s: s.order)

    messages = build_structure_messages(
        title=paper.title,
        requirements=paper.requirements or "",
        target_words=paper.target_words,
        sections=[{"title": s.title} for s in existing],
    )

    plan_text = await chat(messages, db)
    plan = parse_coordinator_response(plan_text)
    if not plan:
        raise HTTPException(status_code=500, detail="AI 规划返回为空，请重试")

    for item in plan:
        item["title"] = _clean_title(item.get("title", ""))

    existing_by_title = {s.title: s for s in existing}
    plan_titles = {item["title"] for item in plan}

    for s in existing:
        if s.title not in plan_titles:
            await db.delete(s)

    for order, item in enumerate(plan):
        title = item["title"]
        if title in existing_by_title:
            s = existing_by_title[title]
            s.order = order
            s.updated_at = datetime.now(timezone.utc)
        else:
            db.add(Section(
                paper_id=paper.id,
                title=title,
                order=order,
            ))

    await db.commit()

    refreshed = await db.execute(
        select(Paper)
        .options(selectinload(Paper.sections))
        .where(Paper.id == paper_id)
    )
    paper = refreshed.scalar_one()
    sections = sorted(paper.sections, key=lambda s: s.order)

    return {
        "sections": [
            {"id": s.id, "title": s.title, "order": s.order, "status": s.status}
            for s in sections
        ],
    }


@router.post("/papers/{paper_id}/plan-instructions")
async def plan_instructions(paper_id: str, db: AsyncSession = Depends(get_db)):
    """AI generates writing instructions for each section."""
    result = await db.execute(
        select(Paper)
        .options(selectinload(Paper.sections))
        .where(Paper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    sections = sorted(paper.sections, key=lambda s: s.order)
    if not sections:
        raise HTTPException(status_code=400, detail="请先规划章节结构")

    messages = build_instruction_messages(
        title=paper.title,
        requirements=paper.requirements or "",
        target_words=paper.target_words,
        sections=[{"title": s.title} for s in sections],
    )

    resp_text = await chat(messages, db)
    plan = parse_instruction_response(resp_text)

    plan_map = {item["title"]: item for item in plan}
    for s in sections:
        if s.title in plan_map:
            s.ai_instruction = plan_map[s.title].get("instruction", "")
            s.updated_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "sections": [
            {
                "id": s.id,
                "title": s.title,
                "ai_instruction": s.ai_instruction,
                "status": s.status,
            }
            for s in sections
        ],
    }


@router.post("/papers/{paper_id}/generate-all")
async def generate_all(paper_id: str, db: AsyncSession = Depends(get_db)):
    """Generate sections: body first, abstract last, then extract keywords."""
    result = await db.execute(
        select(Paper)
        .options(selectinload(Paper.sections), selectinload(Paper.references))
        .where(Paper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    all_sections = sorted(paper.sections, key=lambda s: s.order)
    body_sections = [s for s in all_sections if not is_abstract(s.title)]
    abstract_sections = [s for s in all_sections if is_abstract(s.title)]
    gen_order = body_sections + abstract_sections
    ref_list = [r.content for r in (paper.references or []) if r.content] or None

    async def event_stream():
        generated_contents: dict[str, str] = {}

        try:
            for section in gen_order:
                if section.status == "confirmed":
                    generated_contents[section.title] = section.content_md or ""
                    continue

                yield _sse("section_start", {
                    "section_id": section.id,
                    "title": section.title,
                })

                section.status = "generating"
                section.updated_at = datetime.now(timezone.utc)
                await db.commit()

                instruction = section.ai_instruction or f"撰写「{section.title}」章节"
                target_words = paper.target_words // max(1, len(all_sections))

                if is_abstract(section.title) and generated_contents:
                    summary = "\n\n".join(
                        _compress_section(t, c, 300)
                        for t, c in generated_contents.items() if c
                    )
                    messages = build_section_messages(
                        title=section.title,
                        instruction=instruction,
                        target_words=target_words,
                        full_paper_summary=summary,
                        references=ref_list,
                    )
                else:
                    prev_content = None
                    idx_in_body = body_sections.index(section) if section in body_sections else -1
                    if idx_in_body > 0:
                        prev_title = body_sections[idx_in_body - 1].title
                        prev_content = generated_contents.get(prev_title)
                    messages = build_section_messages(
                        title=section.title,
                        instruction=instruction,
                        target_words=target_words,
                        prev_content=prev_content,
                        references=ref_list,
                    )

                full_content = ""
                async for chunk in stream_chat(messages, db):
                    full_content += chunk
                    yield _sse("chunk", {
                        "section_id": section.id,
                        "content": chunk,
                    })

                cleaned = _clean_ai_content(full_content, section.title)
                section.content_md = cleaned
                section.status = "draft"
                section.updated_at = datetime.now(timezone.utc)
                await db.commit()
                generated_contents[section.title] = cleaned

                yield _sse("section_done", {
                    "section_id": section.id,
                    "content": cleaned,
                })

            # Post-generation: extract reference keywords
            if generated_contents:
                yield _sse("keywords_start", {"message": "正在提取参考文献关键词..."})
                compressed = "\n\n".join(
                    _compress_section(t, c, 200)
                    for t, c in generated_contents.items() if c
                )
                try:
                    kw_messages = build_keyword_messages(
                        title=paper.title,
                        requirements=paper.requirements or "",
                        compressed_content=compressed,
                    )
                    keywords_text = await chat(kw_messages, db)

                    meta = paper.metadata_fields or {}
                    meta["_ai_reference_keywords"] = keywords_text
                    paper.metadata_fields = meta
                    paper.updated_at = datetime.now(timezone.utc)
                    await db.commit()

                    yield _sse("keywords", {"keywords": keywords_text})
                except Exception as kw_err:
                    logger.warning("Keyword extraction failed: %s", kw_err)
                    yield _sse("keywords", {"keywords": ""})

            yield _sse("done", {"message": "All sections generated"})

        except Exception as e:
            logger.exception("Generate-all failed")
            yield _sse("error", {"message": str(e)})

    return _sse_response(event_stream())


@router.post("/papers/{paper_id}/chat")
async def chat_with_ai(
    paper_id: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    context_info = f"论文标题：{paper.title}\n要求：{paper.requirements or '无'}"
    if body.section_id:
        sec_result = await db.execute(select(Section).where(Section.id == body.section_id))
        section = sec_result.scalar_one_or_none()
        if section:
            context_info += f"\n当前章节：{section.title}"
            if section.content_md:
                context_info += f"\n章节内容：\n{section.content_md[:1500]}"

    system_msg = build_system_message()
    system_msg["content"] += f"\n\n当前论文上下文：\n{context_info}"

    messages = [system_msg] + body.messages

    async def event_stream():
        full_content = ""
        try:
            async for chunk in stream_chat(messages, db):
                full_content += chunk
                yield _sse("chunk", {"content": chunk})
            yield _sse("done", {"content": full_content})
        except Exception as e:
            logger.exception("Chat failed")
            yield _sse("error", {"message": str(e)})

    return _sse_response(event_stream())
