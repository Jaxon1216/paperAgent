import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
PAPERS_DIR = DATA_DIR / "papers"

DATA_DIR.mkdir(parents=True, exist_ok=True)
PAPERS_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DATA_DIR / 'paper.db'}")
