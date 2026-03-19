from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.section import Section

router = APIRouter(tags=["sections"])


class SectionCreate(BaseModel):
    title: str
    order: int
    content_md: str = ""
    ai_instruction: str = ""


class SectionUpdate(BaseModel):
    title: str | None = None
    content_md: str | None = None
    status: str | None = None
    ai_instruction: str | None = None


class SectionOrderUpdate(BaseModel):
    order: int


class SectionStatusUpdate(BaseModel):
    status: str


def section_to_dict(s: Section) -> dict:
    return {
        "id": s.id,
        "paper_id": s.paper_id,
        "title": s.title,
        "order": s.order,
        "content_md": s.content_md,
        "status": s.status,
        "ai_instruction": s.ai_instruction,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/papers/{paper_id}/sections")
async def list_sections(paper_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Section).where(Section.paper_id == paper_id).order_by(Section.order)
    )
    sections = result.scalars().all()
    return [section_to_dict(s) for s in sections]


@router.post("/papers/{paper_id}/sections")
async def create_section(paper_id: str, body: SectionCreate, db: AsyncSession = Depends(get_db)):
    section = Section(
        paper_id=paper_id,
        title=body.title,
        order=body.order,
        content_md=body.content_md,
        ai_instruction=body.ai_instruction,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section_to_dict(section)


@router.put("/sections/{section_id}")
async def update_section(section_id: str, body: SectionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Section).where(Section.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    if body.title is not None:
        section.title = body.title
    if body.content_md is not None:
        section.content_md = body.content_md
    if body.status is not None:
        section.status = body.status
    if body.ai_instruction is not None:
        section.ai_instruction = body.ai_instruction
    section.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(section)
    return section_to_dict(section)


@router.put("/sections/{section_id}/order")
async def update_section_order(
    section_id: str, body: SectionOrderUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Section).where(Section.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    section.order = body.order
    section.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(section)
    return section_to_dict(section)


@router.put("/sections/{section_id}/status")
async def update_section_status(
    section_id: str, body: SectionStatusUpdate, db: AsyncSession = Depends(get_db)
):
    valid_statuses = {"empty", "generating", "draft", "confirmed"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    result = await db.execute(select(Section).where(Section.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    section.status = body.status
    section.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(section)
    return section_to_dict(section)


@router.delete("/sections/{section_id}")
async def delete_section(section_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Section).where(Section.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)
    await db.commit()
    return {"ok": True}
