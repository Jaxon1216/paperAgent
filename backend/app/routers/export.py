import logging
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.services.export_service import export_paper_pdf

logger = logging.getLogger(__name__)
router = APIRouter(tags=["export"])


@router.post("/papers/{paper_id}/export/preview")
async def preview_pdf(paper_id: str, db: AsyncSession = Depends(get_db)):
    """Compile and return PDF for in-browser preview."""
    try:
        pdf_bytes = await export_paper_pdf(paper_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        logger.exception("PDF compilation failed")
        raise HTTPException(status_code=500, detail=str(e))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )


@router.get("/papers/{paper_id}/export/download")
async def download_pdf(paper_id: str, db: AsyncSession = Depends(get_db)):
    """Compile and return PDF as a download."""
    try:
        pdf_bytes = await export_paper_pdf(paper_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        logger.exception("PDF compilation failed")
        raise HTTPException(status_code=500, detail=str(e))

    from sqlalchemy import select
    from app.models.paper import Paper
    result = await db.execute(select(Paper.title).where(Paper.id == paper_id))
    title = result.scalar_one_or_none() or "paper"
    filename = quote(f"{title}.pdf")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
        },
    )
