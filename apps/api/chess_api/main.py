import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from chess_api.settings import settings
from chess_api.routers import health, auth as auth_router, children as children_router, lessons as lessons_router, puzzles as puzzles_router, srs as srs_router, games as games_router, gamification as gamification_router, daily as daily_router, live_game as live_game_router, parent as parent_router, teacher as teacher_router, admin as admin_router, settings as settings_router, practice as practice_router, openings as openings_router, pool_images as pool_images_router, presence as presence_router, athletes as athletes_router, custom_tabs as custom_tabs_router, tournaments as tournaments_router, tournament_ws as tournament_ws_router, fun_activities as fun_activities_router


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
    app.include_router(live_game_router.router)
    app.include_router(parent_router.router)
    app.include_router(teacher_router.router)
    app.include_router(admin_router.router)
    app.include_router(settings_router.router)
    app.include_router(practice_router.router)
    app.include_router(openings_router.router)
    app.include_router(pool_images_router.router)
    app.include_router(presence_router.router)
    app.include_router(athletes_router.router)
    app.include_router(custom_tabs_router.router)
    app.include_router(tournaments_router.router)
    app.include_router(tournament_ws_router.router)
    app.include_router(fun_activities_router.router)

    @app.on_event("startup")
    async def _start_scheduler():
        if settings().ENV == "production":
            try:
                from chess_api.workers.weekly_email_job import start_scheduler
                start_scheduler()
            except Exception:
                logging.exception("Failed to start weekly scheduler")

    return app


app = create_app()
