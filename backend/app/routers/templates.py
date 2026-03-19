from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from app.templates.template_registry import get_all_templates, get_template_by_id

router = APIRouter(tags=["templates"])


@router.get("/templates")
async def list_templates():
    templates = get_all_templates()
    return [asdict(t) for t in templates]


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    template = get_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return asdict(template)
