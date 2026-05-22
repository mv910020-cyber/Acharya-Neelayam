from __future__ import annotations

from pathlib import Path


_BACKEND_APP_DIR = Path(__file__).resolve().parent.parent / "backend" / "app"

if _BACKEND_APP_DIR.exists():
    backend_app_path = str(_BACKEND_APP_DIR)
    if backend_app_path not in __path__:
        __path__.append(backend_app_path)
