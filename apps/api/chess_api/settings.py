from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/chess_app"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    LOG_LEVEL: str = "INFO"
    SENDGRID_API_KEY: str = ""
    MAIL_FROM: str = "no-reply@chess-app.local"
    CORS_ORIGINS: str = "http://localhost:3000"
    ENV: str = "development"

    # Madde 2026-09-14 (sunucu analiz motoru): tam maç analizi artık
    # istemci WASM yerine burada, native Stockfish ile hesaplanıyor —
    # bkz. services/game_analysis_engine.py. Değerler tahmini başlangıç
    # noktası; gerçek Railway CPU'suna göre canlıda ölçülüp ayarlanmalı.
    STOCKFISH_PATH: str = "stockfish"
    ANALYSIS_DEPTH: int = 18
    ANALYSIS_MOVETIME_MS: int = 400
    ANALYSIS_THREADS: int = 2
    ANALYSIS_HASH_MB: int = 128
    # Sunucu genelinde aynı anda çalışabilecek analiz işi sayısı — Railway
    # kaynakları paylaşımlı, bu sınır aşırı CPU rekabetini önler.
    ANALYSIS_CONCURRENCY: int = 1

    # Madde 2026-09-15 (Online Dersler): kendi sunucumuzda (self-hosted)
    # barındırılan LiveKit — Zafer'in Railway'de kurduğu servisten gelen
    # gerçek değerler. Varsayılansız: bu üçü verilmeden ders özelliği
    # (token üretimi) çalışamaz, sessizce yanlış bir sunucuya bağlanmaz.
    LIVEKIT_URL: str = ""
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""


_settings: Settings | None = None


def settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
