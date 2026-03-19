from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.reference import Reference

router = APIRouter(tags=["references"])


class ReferenceCreate(BaseModel):
    content: str


class ReferenceUpdate(BaseModel):
    content: str


class ReorderItem(BaseModel):
    id: str
    order: int


class ReorderBody(BaseModel):
    items: list[ReorderItem]


def ref_to_dict(r: Reference) -> dict:
    return {
        "id": r.id,
        "paper_id": r.paper_id,
        "order": r.order,
        "content": r.content,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/papers/{paper_id}/references")
async def list_references(paper_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Reference).where(Reference.paper_id == paper_id).order_by(Reference.order)
    )
    return [ref_to_dict(r) for r in result.scalars().all()]


@router.post("/papers/{paper_id}/references")
async def create_reference(paper_id: str, body: ReferenceCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Reference).where(Reference.paper_id == paper_id).order_by(Reference.order.desc())
    )
    last = result.scalars().first()
    next_order = (last.order + 1) if last else 1

    ref = Reference(paper_id=paper_id, order=next_order, content=body.content)
    db.add(ref)
    await db.commit()
    await db.refresh(ref)
    return ref_to_dict(ref)


@router.put("/references/{ref_id}")
async def update_reference(ref_id: str, body: ReferenceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Reference).where(Reference.id == ref_id))
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    ref.content = body.content
    await db.commit()
    await db.refresh(ref)
    return ref_to_dict(ref)


@router.delete("/references/{ref_id}")
async def delete_reference(ref_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Reference).where(Reference.id == ref_id))
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    await db.delete(ref)
    await db.commit()
    return {"ok": True}


@router.put("/papers/{paper_id}/references/order")
async def reorder_references(paper_id: str, body: ReorderBody, db: AsyncSession = Depends(get_db)):
    for item in body.items:
        result = await db.execute(
            select(Reference).where(Reference.id == item.id, Reference.paper_id == paper_id)
        )
        ref = result.scalar_one_or_none()
        if ref:
            ref.order = item.order
    await db.commit()

    result = await db.execute(
        select(Reference).where(Reference.paper_id == paper_id).order_by(Reference.order)
    )
    return [ref_to_dict(r) for r in result.scalars().all()]
