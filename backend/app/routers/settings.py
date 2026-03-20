import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.setting import Setting

router = APIRouter(tags=["settings"])

LLM_SETTINGS_KEY = "llm_settings"

DEFAULT_LLM_SETTINGS = {
    "api_key": "",
    "model": "deepseek/deepseek-chat",
    "base_url": "",
}


class LLMSettingsUpdate(BaseModel):
    api_key: str = ""
    model: str = "deepseek/deepseek-chat"
    base_url: str = ""


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == LLM_SETTINGS_KEY))
    setting = result.scalar_one_or_none()
    if not setting:
        return DEFAULT_LLM_SETTINGS
    data = json.loads(setting.value)
    data["api_key"] = mask_key(data.get("api_key", ""))
    return data


@router.put("/settings")
async def update_settings(body: LLMSettingsUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == LLM_SETTINGS_KEY))
    setting = result.scalar_one_or_none()

    value_dict = body.model_dump()

    if setting:
        old_data = json.loads(setting.value)
        if value_dict["api_key"] == mask_key(old_data.get("api_key", "")):
            value_dict["api_key"] = old_data["api_key"]
        setting.value = json.dumps(value_dict)
    else:
        setting = Setting(key=LLM_SETTINGS_KEY, value=json.dumps(value_dict))
        db.add(setting)

    await db.commit()

    value_dict["api_key"] = mask_key(value_dict["api_key"])
    return value_dict


@router.post("/settings/test")
async def test_settings(db: AsyncSession = Depends(get_db)):
    """Send a minimal request to verify the API key and model work."""
    from app.services.llm_service import chat

    try:
        reply = await chat(
            [{"role": "user", "content": "Hello, reply with only: OK"}],
            db,
        )
        return {"ok": True, "reply": reply.strip()[:200]}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        error_msg = str(e)
        if len(error_msg) > 300:
            error_msg = error_msg[:300] + "..."
        return {"ok": False, "error": error_msg}


def mask_key(key: str) -> str:
    if not key or len(key) < 8:
        return key
    return key[:4] + "*" * (len(key) - 8) + key[-4:]
