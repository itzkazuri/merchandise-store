"""Entrypoint cepat untuk development.

Jalankan dari folder backend/:

    uv run main.py

Setara dengan:

    uv run uvicorn app.main:app --reload
"""

import uvicorn

if __name__ == "__main__":
    from app.core.startup_checks import check_startup_dependencies

    if not check_startup_dependencies():
        raise SystemExit(1)

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
