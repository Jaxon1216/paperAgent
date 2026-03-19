import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    template_id: Mapped[str] = mapped_column(String(50), nullable=False)
    target_words: Mapped[int] = mapped_column(Integer, default=8000)
    metadata_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    requirements: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="drafting")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    sections = relationship("Section", back_populates="paper", cascade="all, delete-orphan", order_by="Section.order")
    references = relationship(
        "Reference", back_populates="paper", cascade="all, delete-orphan", order_by="Reference.order"
    )
    images = relationship("Image", back_populates="paper", cascade="all, delete-orphan")
