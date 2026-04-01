from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.routes.reviews import router as reviews_router
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title="WorkRule AI API",
        version="0.1.0",
        description="Structured employment rules review backend",
    )
    app.include_router(health_router)
    app.include_router(reviews_router)
    return app


app = create_app()

