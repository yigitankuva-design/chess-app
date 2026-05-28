import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from chess_api.settings import settings
from chess_api.routers import health, auth as auth_router, children as children_router, lessons as lessons_router, puzzles as puzzles_router, srs as srs_router, games as games_router, gamification as gamification_router, daily as daily_router


def create_app() -> FastAPI:
    s = settings()
    logging.basicConfig(level=s.LOG_LEVEL)

    app = FastAPI(
        title="Chess App API",
        version="0.1.0",
        description="Backend for the kids' chess teaching app",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in s.CORS_ORIGINS.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth_router.router)
    app.include_router(children_router.router)
    app.include_router(lessons_router.router)
    app.include_router(puzzles_router.router)
    app.include_router(srs_router.router)
    app.include_router(games_router.router)
    app.include_router(gamification_router.router)
    app.include_router(daily_router.router)
    return app


app = create_app()
