from __future__ import annotations

import os
from pathlib import Path

from dotenv import dotenv_values


APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ROOT_DIR = BACKEND_DIR.parent

_ENV_LOADED = False
_CONFIG: dict[str, str] = {}


def load_environment() -> None:
    global _ENV_LOADED, _CONFIG
    if _ENV_LOADED:
        return

    root_env = ROOT_DIR / ".env"
    root_env_local = ROOT_DIR / ".env.local"
    backend_env = BACKEND_DIR / ".env"
    backend_env_local = BACKEND_DIR / ".env.local"

    merged_config: dict[str, str] = {}
    for env_path in (root_env, root_env_local, backend_env, backend_env_local):
        if env_path.exists():
            merged_config.update(
                {
                    key: value
                    for key, value in dotenv_values(env_path).items()
                    if value is not None
                }
            )

    # Real process environment must win over file-based defaults.
    merged_config.update({key: value for key, value in os.environ.items()})
    _CONFIG = merged_config

    _ENV_LOADED = True


def get_setting(name: str, default: str = "") -> str:
    load_environment()
    return _CONFIG.get(name, default).strip()


def get_database_url() -> str:
    return get_setting("DATABASE_URL")


def get_gemini_api_key() -> str:
    return get_setting("GEMINI_API_KEY")


def get_gemini_model() -> str:
    model_name = get_setting("GEMINI_MODEL", "gemini-2.5-flash")
    return model_name or "gemini-2.5-flash"


def get_secret_key() -> str:
    secret_key = get_setting("SECRET_KEY")
    return secret_key or "your-secret-key-change-in-production"


def get_api_host() -> str:
    host = get_setting("API_HOST", "0.0.0.0")
    return host or "0.0.0.0"


def get_api_port() -> int:
    raw_port = get_setting("API_PORT", "8000")
    try:
        return int(raw_port)
    except ValueError:
        return 8000


def is_debug_enabled() -> bool:
    return get_setting("DEBUG", "false").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


load_environment()
