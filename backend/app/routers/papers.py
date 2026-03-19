from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.connection import get_db
from app.models.paper import Paper
from app.models.section import Section
from app.templates.template_registry import get_template_by_id

router = APIRouter(tags=["papers"])


class SectionOverride(BaseModel):
    title: str
    order: int
    enabled: bool = True


class PaperCreate(BaseModel):
    title: str
    template_id: str
    target_words: int = 8000
    metadata_fields: dict = {}
    requirements: str = ""
    sections: list[SectionOverride] | None = None


class PaperUpdate(BaseModel):
    title: str | None = None
    target_words: int | None = None
    metadata_fields: dict | None = None
    requirements: str | None = None


def paper_to_dict(paper: Paper) -> dict:
    return {
        "id": paper.id,
        "title": paper.title,
        "template_id": paper.template_id,
        "target_words": paper.target_words,
        "metadata_fields": paper.metadata_fields,
        "requirements": paper.requirements,
        "status": paper.status,
        "created_at": paper.created_at.isoformat() if paper.created_at else None,
        "updated_at": paper.updated_at.isoformat() if paper.updated_at else None,
        "sections": [
            {
                "id": s.id,
                "title": s.title,
                "order": s.order,
                "content_md": s.content_md,
                "status": s.status,
                "ai_instruction": s.ai_instruction,
            }
            for s in paper.sections
        ]
        if paper.sections
        else [],
        "references": [
            {"id": r.id, "order": r.order, "content": r.content}
            for r in paper.references
        ]
        if paper.references
        else [],
    }


@router.get("/papers")
async def list_papers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Paper).options(selectinload(Paper.sections)).order_by(Paper.updated_at.desc())
    )
    papers = result.scalars().all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "template_id": p.template_id,
            "target_words": p.target_words,
            "status": p.status,
            "section_count": len(p.sections) if p.sections else 0,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in papers
    ]


@router.post("/papers")
async def create_paper(body: PaperCreate, db: AsyncSession = Depends(get_db)):
    template = get_template_by_id(body.template_id)
    if not template:
        raise HTTPException(status_code=400, detail=f"Unknown template: {body.template_id}")

    paper = Paper(
        title=body.title,
        template_id=body.template_id,
        target_words=body.target_words,
        metadata_fields=body.metadata_fields,
        requirements=body.requirements,
    )
    db.add(paper)
    await db.flush()

    if body.sections:
        for s in body.sections:
            if not s.enabled:
                continue
            tmpl_section = next((ts for ts in template.default_sections if ts.title == s.title), None)
            description = tmpl_section.description if tmpl_section else ""
            section = Section(
                paper_id=paper.id,
                title=s.title,
                order=s.order,
                ai_instruction=description,
            )
            db.add(section)
    else:
        for ds in template.default_sections:
            section = Section(
                paper_id=paper.id,
                title=ds.title,
                order=ds.order,
                ai_instruction=ds.description,
            )
            db.add(section)

    await db.commit()

    result = await db.execute(
        select(Paper)
        .options(selectinload(Paper.sections), selectinload(Paper.references))
        .where(Paper.id == paper.id)
    )
    paper = result.scalar_one()
    return paper_to_dict(paper)


@router.get("/papers/{paper_id}")
async def get_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Paper)
        .options(selectinload(Paper.sections), selectinload(Paper.references))
        .where(Paper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper_to_dict(paper)


@router.put("/papers/{paper_id}")
async def update_paper(paper_id: str, body: PaperUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Paper)
        .options(selectinload(Paper.sections), selectinload(Paper.references))
        .where(Paper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if body.title is not None:
        paper.title = body.title
    if body.target_words is not None:
        paper.target_words = body.target_words
    if body.metadata_fields is not None:
        paper.metadata_fields = body.metadata_fields
    if body.requirements is not None:
        paper.requirements = body.requirements
    paper.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(paper)
    return paper_to_dict(paper)


@router.delete("/papers/{paper_id}")
async def delete_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    await db.delete(paper)
    await db.commit()
    return {"ok": True}
