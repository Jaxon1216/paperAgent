import logging
import os
import re
import subprocess
import tempfile
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import BASE_DIR, PAPERS_DIR
from app.models.paper import Paper
from app.models.section import Section
from app.templates.template_registry import get_template_by_id

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"


def _sanitize_markdown(md: str) -> str:
    """Clean up common LLM markdown issues before compilation."""
    lines = md.split("\n")
    result = []
    in_code_block = False
    for line in lines:
        if line.strip().startswith("```"):
            in_code_block = not in_code_block
        result.append(line)
    if in_code_block:
        result.append("```")

    text = "\n".join(result)
    # Fix unclosed inline math (odd number of single $)
    # Only fix if there's an odd count of non-escaped $
    return text


_CITE_RE = re.compile(r"(?<!!)\[(\d+(?:[,，\-–]\s*\d+)*)\](?!\()")


def _superscript_citations(text: str) -> str:
    """Convert inline [n] citation markers to Typst superscript via Pandoc raw inline."""
    return _CITE_RE.sub(r"`#super[[\1]]`{=typst}", text)


_HEADING_RE = re.compile(r"^(#{1,6})\s")


def _normalize_heading_levels(content: str) -> str:
    """Shift sub-heading levels so the shallowest is ## (level 2).

    Section titles are inserted as # (level 1) by the merge function.
    AI content should use ## for the first sub-level, but sometimes uses
    ### or deeper. This function detects the minimum level and shifts all
    headings up so the minimum becomes ##.
    """
    lines = content.split("\n")

    min_level = 7
    for line in lines:
        m = _HEADING_RE.match(line)
        if m:
            level = len(m.group(1))
            if level < min_level:
                min_level = level

    if min_level <= 2 or min_level > 6:
        return content

    shift = min_level - 2
    result = []
    for line in lines:
        m = _HEADING_RE.match(line)
        if m:
            old_level = len(m.group(1))
            new_level = max(2, old_level - shift)
            result.append("#" * new_level + line[old_level:])
        else:
            result.append(line)
    return "\n".join(result)


UNNUMBERED_SECTIONS = {"摘要", "Abstract", "参考文献", "References", "附录", "Appendix"}


def _heading(title: str) -> str:
    """Return a markdown heading, unnumbered for special sections."""
    if title in UNNUMBERED_SECTIONS:
        return f"# {title} {{-}}\n"
    return f"# {title}\n"


def merge_paper_markdown(
    paper: Paper,
    sections: list[Section],
    references: list,
) -> str:
    """Merge all sections into a single markdown document."""
    parts = []

    for section in sorted(sections, key=lambda s: s.order):
        if not section.content_md or not section.content_md.strip():
            continue

        if section.title == "参考文献" and references:
            parts.append(_heading(section.title))
            for i, ref in enumerate(references, 1):
                parts.append(f"[{i}] {ref.content}\n")
            parts.append("")
            continue

        parts.append(_heading(section.title))
        normalized = _normalize_heading_levels(section.content_md.strip())
        parts.append(_superscript_citations(normalized))
        parts.append("")

    if not any(s.title == "参考文献" for s in sections) and references:
        parts.append(_heading("参考文献"))
        for i, ref in enumerate(references, 1):
            parts.append(f"[{i}] {ref.content}\n")
        parts.append("")

    return "\n".join(parts)


def compile_pdf(
    merged_md: str,
    template_id: str,
    variables: dict[str, str],
    paper_dir: Path | None = None,
) -> bytes:
    """Compile markdown to PDF via Pandoc + Typst.

    Returns the PDF bytes.
    """
    template = get_template_by_id(template_id)
    if not template:
        raise ValueError(f"Template not found: {template_id}")

    template_path = TEMPLATES_DIR / template.typst_template
    if not template_path.exists():
        raise FileNotFoundError(f"Template file not found: {template_path}")

    with tempfile.TemporaryDirectory() as tmpdir:
        md_path = os.path.join(tmpdir, "paper.md")
        pdf_path = os.path.join(tmpdir, "paper.pdf")

        cleaned_md = _sanitize_markdown(merged_md)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(cleaned_md)

        cmd = [
            "pandoc", md_path,
            "-o", pdf_path,
            "--pdf-engine=typst",
            f"--template={template_path}",
        ]

        resource_paths = [tmpdir]
        if paper_dir and paper_dir.exists():
            resource_paths.append(str(paper_dir))
        cmd.append(f"--resource-path={':'.join(resource_paths)}")

        for key, value in variables.items():
            if value:
                cmd.extend(["-V", f"{key}={value}"])

        logger.info("Running pandoc: %s", " ".join(cmd))

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            error_msg = result.stderr or "Unknown compilation error"
            # Filter out font warnings which are expected on different platforms
            real_errors = [
                line for line in error_msg.strip().split("\n")
                if line.strip()
                and "warning: unknown font family" not in line
                and line.strip() != "│"
                and not re.match(r"^\s*┌─", line)
                and not re.match(r"^\s*\d+\s*│", line)
            ]
            if result.returncode != 0 and not os.path.exists(pdf_path):
                raise RuntimeError(f"PDF compilation failed:\n{error_msg}")

        if not os.path.exists(pdf_path):
            raise RuntimeError("PDF file was not generated")

        with open(pdf_path, "rb") as f:
            return f.read()


async def export_paper_pdf(paper_id: str, db: AsyncSession) -> bytes:
    """Full pipeline: load paper from DB, merge markdown, compile PDF."""
    result = await db.execute(
        select(Paper)
        .options(selectinload(Paper.sections), selectinload(Paper.references))
        .where(Paper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise ValueError(f"Paper not found: {paper_id}")

    sections = sorted(paper.sections, key=lambda s: s.order)
    references = sorted(paper.references, key=lambda r: r.order) if paper.references else []

    merged_md = merge_paper_markdown(paper, sections, references)
    if not merged_md.strip():
        raise ValueError("论文内容为空，无法导出 PDF")

    template = get_template_by_id(paper.template_id)
    variables: dict[str, str] = {"title": paper.title}
    if paper.metadata_fields:
        for key, value in paper.metadata_fields.items():
            if key.startswith("_"):
                continue
            if not value:
                continue
            if key == "author":
                names = [n.strip() for n in value.splitlines() if n.strip()]
                variables[key] = "   ".join(names)
            else:
                variables[key] = value

    heading_style = (paper.metadata_fields or {}).get("_heading_style", "")
    if not heading_style and template:
        heading_style = template.default_heading_style

    if heading_style == "chinese":
        variables["heading_chinese"] = "true"
    elif heading_style == "arabic":
        variables["heading_arabic"] = "true"

    paper_dir = PAPERS_DIR / paper_id
    return compile_pdf(merged_md, paper.template_id, variables, paper_dir)
