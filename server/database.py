
import os
import pg8000.dbapi
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables (.env.local takes priority over .env)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env.local", override=True)


def get_db_connection():
    required = ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"]

    missing = [
        key for key in required
        if not os.getenv(key)
    ]

    if missing:
        raise ValueError(
            f"Missing PostgreSQL environment variables: {missing}"
        )

    return pg8000.dbapi.connect(
        host=os.getenv("PGHOST"),
        port=int(os.getenv("PGPORT", "5432")),
        database=os.getenv("PGDATABASE"),
        user=os.getenv("PGUSER"),
        password=os.getenv("PGPASSWORD")
    )


def fetchone_dict(cursor):
    row = cursor.fetchone()
    if not row or not cursor.description:
        return None
    cols = [col[0] for col in cursor.description]
    return dict(zip(cols, row))


def fetchall_dict(cursor):
    rows = cursor.fetchall()
    if not rows or not cursor.description:
        return []
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, r)) for r in rows]



