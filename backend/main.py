from app.config import get_api_host, get_api_port, is_debug_enabled
from app.main import app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=get_api_host(),
        port=get_api_port(),
        reload=is_debug_enabled(),
    )
