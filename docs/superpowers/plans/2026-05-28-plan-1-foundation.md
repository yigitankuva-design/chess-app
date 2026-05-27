# Plan 1: Foundation / Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bare-minimum monorepo skeleton (Next.js PWA + FastAPI backend + PostgreSQL + Redis) deployed to Vercel + Railway, with a working "hello chess" health check and CI green on push.

**Architecture:** Monorepo with `apps/web` (Next.js 15 PWA) and `apps/api` (Python FastAPI). Frontend on Vercel, backend + DB + Redis on Railway. GitHub Actions runs lint/test on every push. No business logic yet — just plumbing.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, TailwindCSS 4, Python 3.12, FastAPI 0.115+, SQLAlchemy 2, Alembic, PostgreSQL 16, Redis 7, pytest, Vitest, Playwright, GitHub Actions.

**Bağımlılık:** Yok (sıfırdan başlangıç)
**Süre tahmini:** 1-2 hafta
**Test geçidi:** Plan sonundaki tüm Acceptance Tests yeşil olmadan Plan 2'ye geçilmez.

---

## File Structure

Bu planda oluşturulacak yapı:

```
chess-app/                     (mevcut git repo)
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions: lint + test
├── apps/
│   ├── web/                   # Next.js PWA
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── api/
│   │   │       └── health/route.ts
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── api-client.ts
│   │   ├── tests/
│   │   │   └── smoke.test.tsx
│   │   ├── public/
│   │   │   └── manifest.json
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── vitest.config.ts
│   └── api/                   # FastAPI backend
│       ├── chess_api/
│       │   ├── __init__.py
│       │   ├── main.py
│       │   ├── settings.py
│       │   ├── database.py
│       │   └── routers/
│       │       ├── __init__.py
│       │       └── health.py
│       ├── alembic/
│       │   ├── env.py
│       │   ├── script.py.mako
│       │   └── versions/
│       ├── tests/
│       │   ├── __init__.py
│       │   ├── conftest.py
│       │   └── test_health.py
│       ├── alembic.ini
│       ├── pyproject.toml
│       ├── requirements.txt
│       ├── Procfile
│       └── railway.json
├── e2e/
│   ├── tests/
│   │   └── smoke.spec.ts
│   ├── playwright.config.ts
│   └── package.json
├── package.json               # root: workspace config
├── README.md                  # (mevcut, güncellenecek)
├── .gitignore                 # (mevcut, güncellenecek)
└── .editorconfig
```

---

## Task 1: Workspace ve Kök Dosyalar

**Files:**
- Create: `package.json`
- Create: `.editorconfig`
- Modify: `.gitignore` (yeni satırlar ekle)

- [ ] **Step 1.1: Root `package.json` (workspace) yaz**

```json
{
  "name": "chess-app",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "apps/web",
    "e2e"
  ],
  "scripts": {
    "dev:web": "npm --workspace apps/web run dev",
    "build:web": "npm --workspace apps/web run build",
    "test:web": "npm --workspace apps/web run test",
    "test:e2e": "npm --workspace e2e run test",
    "lint": "npm --workspace apps/web run lint"
  }
}
```

- [ ] **Step 1.2: `.editorconfig` yaz**

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true

[*.py]
indent_size = 4

[Makefile]
indent_style = tab
```

- [ ] **Step 1.3: `.gitignore`'a ekle**

Mevcut `.gitignore`'un sonuna ekle:

```
# Python venv (Windows)
.venv/
venv/
env/

# Next.js
.next/
out/
.vercel/

# Workspace
*.tsbuildinfo
next-env.d.ts

# Playwright
playwright-report/
test-results/
```

- [ ] **Step 1.4: Commit**

```bash
git add package.json .editorconfig .gitignore
git commit -m "chore(scaffold): root workspace config + editorconfig"
```

---

## Task 2: Frontend İskelet (Next.js + TypeScript + Tailwind)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/public/manifest.json`
- Create: `apps/web/.eslintrc.json`

- [ ] **Step 2.1: `apps/web/package.json`**

```json
{
  "name": "@chess-app/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "happy-dom": "^15.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2.2: `apps/web/next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2.3: `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2.4: `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        chessboard: {
          light: '#f0d9b5',
          dark: '#b58863',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2.5: `apps/web/postcss.config.mjs`**

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 2.6: `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 250 250 250;
  --foreground: 17 17 17;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 17 17 17;
    --foreground: 250 250 250;
  }
}

body {
  color: rgb(var(--foreground));
  background: rgb(var(--background));
}
```

- [ ] **Step 2.7: `apps/web/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Çocuklar İçin Satranç',
  description: 'Çocuklar için satranç öğretim uygulaması',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2.8: `apps/web/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">♟ Çocuklar İçin Satranç</h1>
      <p className="text-lg opacity-75">Hoş geldiniz! İskelet hazır.</p>
    </main>
  );
}
```

- [ ] **Step 2.9: `apps/web/public/manifest.json`**

```json
{
  "name": "Çocuklar İçin Satranç",
  "short_name": "ÇİS",
  "description": "Çocuklar için satranç öğretim uygulaması",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2.10: `apps/web/.eslintrc.json`**

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

- [ ] **Step 2.11: Bağımlılıkları kur ve build'i doğrula**

```bash
cd apps/web && npm install
npm run build
```

Beklenen: Build hata vermez, `.next/` oluşur.

- [ ] **Step 2.12: Commit**

```bash
git add apps/web/
git commit -m "feat(web): Next.js 15 + TypeScript + Tailwind scaffold"
```

---

## Task 3: Frontend Smoke Test (Vitest)

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/tests/setup.ts`
- Create: `apps/web/tests/smoke.test.tsx`

- [ ] **Step 3.1: `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
});
```

- [ ] **Step 3.2: `apps/web/tests/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3.3: TDD — failing test yaz: `apps/web/tests/smoke.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the welcome heading', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: /Çocuklar İçin Satranç/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.4: Testi çalıştır, geçmesini bekle (zaten implement edildi)**

```bash
cd apps/web && npm test
```

Beklenen: 1 passed.

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/tests/
git commit -m "test(web): Vitest setup + smoke test for HomePage"
```

---

## Task 4: Backend İskelet (FastAPI + SQLAlchemy + Alembic)

**Files:**
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/requirements.txt`
- Create: `apps/api/Procfile`
- Create: `apps/api/railway.json`
- Create: `apps/api/chess_api/__init__.py`
- Create: `apps/api/chess_api/settings.py`
- Create: `apps/api/chess_api/database.py`
- Create: `apps/api/chess_api/main.py`
- Create: `apps/api/chess_api/routers/__init__.py`
- Create: `apps/api/chess_api/routers/health.py`
- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/alembic/script.py.mako`

- [ ] **Step 4.1: `apps/api/pyproject.toml`**

```toml
[project]
name = "chess-api"
version = "0.1.0"
description = "Chess teaching app backend"
requires-python = ">=3.12"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 4.2: `apps/api/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy==2.0.36
alembic==1.13.3
asyncpg==0.30.0
psycopg2-binary==2.9.10
pydantic==2.9.2
pydantic-settings==2.6.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
python-chess==1.999
redis==5.2.0
httpx==0.27.2
fastapi-mail==1.4.2

# Dev
pytest==8.3.3
pytest-asyncio==0.24.0
pytest-cov==5.0.0
```

- [ ] **Step 4.3: `apps/api/Procfile`**

```
web: uvicorn chess_api.main:app --host 0.0.0.0 --port $PORT
```

- [ ] **Step 4.4: `apps/api/railway.json`**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "uvicorn chess_api.main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

- [ ] **Step 4.5: `apps/api/chess_api/__init__.py`** (boş dosya)

```python
```

- [ ] **Step 4.6: `apps/api/chess_api/settings.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/chess_app"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str = "http://localhost:3000"
    ENV: str = "development"


_settings: Settings | None = None


def settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
```

- [ ] **Step 4.7: `apps/api/chess_api/database.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from chess_api.settings import settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings().DATABASE_URL,
            echo=False,
            pool_pre_ping=True,
        )
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _session_factory


async def get_db() -> AsyncSession:
    """FastAPI dependency: yields a per-request DB session."""
    async with get_session_factory()() as session:
        yield session
```

- [ ] **Step 4.8: `apps/api/chess_api/routers/__init__.py`** (boş)

```python
```

- [ ] **Step 4.9: `apps/api/chess_api/routers/health.py`**

```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "chess-api"}
```

- [ ] **Step 4.10: `apps/api/chess_api/main.py`**

```python
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from chess_api.settings import settings
from chess_api.routers import health


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
    return app


app = create_app()
```

- [ ] **Step 4.11: `apps/api/alembic.ini`**

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = postgresql://postgres:postgres@localhost:5432/chess_app

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 4.12: `apps/api/alembic/env.py`**

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from chess_api.database import Base
from chess_api.settings import settings as app_settings

config = context.config

# Override URL from app settings (sync version for alembic)
sync_url = app_settings().DATABASE_URL.replace("+asyncpg", "")
config.set_main_option("sqlalchemy.url", sync_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4.13: `apps/api/alembic/script.py.mako`**

```python
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4.14: alembic/versions/.gitkeep**

```
```

- [ ] **Step 4.15: Bağımlılıkları kur ve sunucuyu manuel test et**

```bash
cd apps/api
python -m venv .venv
source .venv/Scripts/activate  # Windows Git Bash; PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn chess_api.main:app --reload
```

Tarayıcıdan `http://localhost:8000/health` aç. Beklenen: `{"status":"ok","service":"chess-api"}`.

Ctrl+C ile durdur.

- [ ] **Step 4.16: Commit**

```bash
git add apps/api/
git commit -m "feat(api): FastAPI scaffold with /health, SQLAlchemy, Alembic"
```

---

## Task 5: Backend Smoke Test (pytest)

**Files:**
- Create: `apps/api/tests/__init__.py`
- Create: `apps/api/tests/conftest.py`
- Create: `apps/api/tests/test_health.py`

- [ ] **Step 5.1: `apps/api/tests/__init__.py`** (boş)

```python
```

- [ ] **Step 5.2: `apps/api/tests/conftest.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from chess_api.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 5.3: TDD — failing test: `apps/api/tests/test_health.py`**

```python
async def test_health_endpoint_returns_ok(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "chess-api"
```

- [ ] **Step 5.4: Test çalıştır, geçmesini doğrula**

```bash
cd apps/api && pytest tests/ -v
```

Beklenen: 1 passed.

- [ ] **Step 5.5: Commit**

```bash
git add apps/api/tests/
git commit -m "test(api): pytest setup + /health smoke test"
```

---

## Task 6: Frontend ↔ Backend API Client

**Files:**
- Create: `apps/web/lib/api-client.ts`
- Create: `apps/web/app/api/health/route.ts` (Next.js BFF endpoint)
- Modify: `apps/web/tests/smoke.test.tsx` (skip — yeni dosya)
- Create: `apps/web/tests/api-client.test.ts`

- [ ] **Step 6.1: `apps/web/lib/api-client.ts`**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export const apiClient = {
  health: () => request<HealthResponse>('/health'),
};
```

- [ ] **Step 6.2: TDD — failing test: `apps/web/tests/api-client.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiError } from '@/lib/api-client';

describe('apiClient.health', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns parsed JSON on 200', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'chess-api' }),
    });
    const result = await apiClient.health();
    expect(result).toEqual({ status: 'ok', service: 'chess-api' });
  });

  it('throws ApiError on non-2xx', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 503,
    });
    await expect(apiClient.health()).rejects.toThrow(ApiError);
  });
});
```

- [ ] **Step 6.3: Test çalıştır**

```bash
cd apps/web && npm test
```

Beklenen: 2 passed (smoke + api-client).

- [ ] **Step 6.4: Commit**

```bash
git add apps/web/lib/ apps/web/tests/api-client.test.ts
git commit -m "feat(web): API client with typed health endpoint"
```

---

## Task 7: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 7.1: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  web:
    name: Web (Next.js)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: apps/web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  api:
    name: API (FastAPI)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'
          cache-dependency-path: apps/api/requirements.txt
      - run: pip install -r requirements.txt
      - run: pytest tests/ -v --cov=chess_api --cov-report=term

  e2e:
    name: E2E (Playwright)
    runs-on: ubuntu-latest
    needs: [web, api]
    defaults:
      run:
        working-directory: e2e
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm test
```

- [ ] **Step 7.2: Commit**

```bash
git add .github/
git commit -m "ci: GitHub Actions for web + api + e2e"
```

---

## Task 8: E2E Smoke Test (Playwright)

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/tests/smoke.spec.ts`

- [ ] **Step 8.1: `e2e/package.json`**

```json
{
  "name": "@chess-app/e2e",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 8.2: `e2e/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'npm --workspace apps/web run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    cwd: '..',
  },
});
```

- [ ] **Step 8.3: `e2e/tests/smoke.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('homepage shows welcome heading', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Çocuklar İçin Satranç/i })
  ).toBeVisible();
});
```

- [ ] **Step 8.4: Lokal olarak Playwright kur ve testi çalıştır**

```bash
cd e2e
npm install
npx playwright install chromium
npm test
```

Beklenen: 1 passed (homepage smoke).

- [ ] **Step 8.5: Commit**

```bash
git add e2e/
git commit -m "test(e2e): Playwright smoke test for homepage"
```

---

## Task 9: GitHub Repo + Vercel + Railway Deploy

**Bu task elle ekran üzerinden yapılır — komutlarla otomatize edilemez.**

- [ ] **Step 9.1: GitHub'da yeni repo oluştur**

GitHub'a git, "New repository" → `chess-app` adı, private veya public. README/`.gitignore`/license ekleme (zaten lokalde var).

- [ ] **Step 9.2: Lokal repo'yu remote'a bağla ve push et**

```bash
cd /c/Users/muham/chess-app
git remote add origin https://github.com/<kullaniciadin>/chess-app.git
git push -u origin main
```

- [ ] **Step 9.3: Vercel'e bağla**

Vercel dashboard → New Project → `chess-app` repo'sunu import et.
- Root Directory: `apps/web`
- Framework Preset: Next.js
- Environment variable: `NEXT_PUBLIC_API_URL` = (Railway URL'i, sonraki adımda alacağız)

Deploy → "hello chess" sayfası canlıda görünmeli (API URL boş olsa bile).

- [ ] **Step 9.4: Railway'e backend bağla**

Railway dashboard → mevcut "astonishing-wisdom" projesine yeni servis ekle veya yeni proje.
- "Deploy from GitHub repo" → `chess-app` seç
- Root Directory: `apps/api`
- Otomatik Nixpacks tespit eder

Servis ayarlarında env değişkenleri:
- `DATABASE_URL` (PostgreSQL plugin'i ekledikten sonra otomatik)
- `REDIS_URL` (Redis plugin'i ekledikten sonra otomatik)
- `JWT_SECRET` = (güçlü random string)
- `CORS_ORIGINS` = (Vercel deploy URL'i)
- `ENV` = `production`

Generate Domain → `https://chess-api-xxx.up.railway.app` gibi bir URL al.

- [ ] **Step 9.5: Vercel'e backend URL'i ekle**

Vercel → Project → Settings → Environment Variables
- `NEXT_PUBLIC_API_URL` = `https://chess-api-xxx.up.railway.app`

Redeploy.

- [ ] **Step 9.6: Health check'i canlı doğrula**

Tarayıcıdan: `https://chess-api-xxx.up.railway.app/health`
Beklenen: `{"status":"ok","service":"chess-api"}`

- [ ] **Step 9.7: Commit (yapılandırma notu)**

```bash
# DOKUMAN VE NOT: README'yi deploy URL'leri ile güncelle
git add README.md
git commit -m "docs(readme): add live deployment URLs"
git push
```

---

## Task 10: README ve Dokümantasyon Güncellemesi

**Files:**
- Modify: `README.md`

- [ ] **Step 10.1: README'yi güncelle**

Mevcut README'nin sonuna ekle:

```markdown
## Yerel Geliştirme

### Gereksinimler
- Node.js 22+
- Python 3.12+
- PostgreSQL 16 (lokal Docker önerilir)
- Redis 7 (lokal Docker önerilir)

### Kurulum

```bash
# Web (terminal 1)
cd apps/web
npm install
npm run dev   # http://localhost:3000

# API (terminal 2)
cd apps/api
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
uvicorn chess_api.main:app --reload   # http://localhost:8000
```

### Test

```bash
npm run test:web    # Vitest (frontend unit)
cd apps/api && pytest   # pytest (backend)
npm run test:e2e    # Playwright (E2E, web dev sunucusu gerekli)
```

## Canlı Ortam

- Frontend: <Vercel URL>
- API: <Railway URL>
- Sağlık: `/health`
```

- [ ] **Step 10.2: Commit**

```bash
git add README.md
git commit -m "docs(readme): local dev setup + test instructions"
git push
```

---

## ACCEPTANCE TESTS — Plan 1 Test Geçidi

**Aşağıdakilerin TÜMÜ yeşil olmalı, Plan 2'ye geçilmez aksi halde:**

### Lokal Testler
- [ ] `cd apps/web && npm test` → 2/2 passed
- [ ] `cd apps/api && pytest tests/ -v` → 1/1 passed
- [ ] `cd e2e && npm test` → 1/1 passed (web dev sunucusu açıkken)

### Lokal Manuel Testler
- [ ] `cd apps/web && npm run dev` → http://localhost:3000 açılır, "♟ Çocuklar İçin Satranç" başlığı görünür
- [ ] `cd apps/api && uvicorn chess_api.main:app --reload` → http://localhost:8000/health döner `{"status":"ok"}`
- [ ] Frontend'in console'unda kırmızı hata yok

### CI Testleri
- [ ] GitHub'a push → Actions sekmesinde 3 workflow (web, api, e2e) **yeşil tik** alır
- [ ] PR açılırsa CI yeniden çalışır ve geçer

### Canlı Ortam Testleri
- [ ] Vercel deploy başarılı, public URL'den ana sayfa açılır
- [ ] Railway deploy başarılı, `/health` public URL'den döner
- [ ] Vercel'in `NEXT_PUBLIC_API_URL`'i Railway'i gösteriyor
- [ ] CORS hatası yok (browser console temiz)

### Repo Sağlığı
- [ ] GitHub repo'da branch protection açık (main'e direkt push engelli, PR + CI gerekli)
- [ ] README.md güncellenmiş, deploy URL'leri yazılı
- [ ] `.env` dosyaları repo'da YOK (`.gitignore` doğru çalışıyor)

**Tümü ✅ ise Plan 2'ye geç.**

---

## Self-Review Notları

Bu plan spec'in sadece "yapı kurma" kısmını kapsar. İş mantığı yok — sadece:
- Çalışan iki uygulama (web + api)
- Aralarındaki bağlantı (CORS + API client)
- CI green
- Canlı deploy

Veri modeli (Plan 2), auth (Plan 2), business logic (Plan 3+) sonraki planlarda.

Spec ile uyumlu: Stack seçimleri Bölüm 5'teki tabloyla aynı. Path'lar Bölüm 9'daki yapıya uygun. Test araçları Bölüm 5'teki tabloyla aynı (Vitest, pytest, Playwright).

Kritik karar: monorepo (apps/web + apps/api) kullandık. Bu Bölüm 4'teki "tek codebase" mantığını destekler. Alternatif iki ayrı repo olabilirdi, ama tek repo'da senkronize git push ile her iki tarafı bir arada test etmek daha sağlam.
