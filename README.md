# Çocuklar İçin Satranç Öğretim Uygulaması

8-14 yaş çocuklara satranç öğreten PWA. Birincil hedef: 8-12 yaş.

## Mevcut Durum

🟢 **Plan 1 (Foundation/Scaffold) tamamlandı** — V1'in 8 plandan oluşan yol haritasının ilki canlıda.

- **Frontend (Vercel):** [chess-app-web-one.vercel.app](https://chess-app-web-one.vercel.app)
- **Backend (Railway):** [chess-app-production-1dab.up.railway.app](https://chess-app-production-1dab.up.railway.app)
- **Sağlık kontrolü:** [/health](https://chess-app-production-1dab.up.railway.app/health) → `{"status":"ok","service":"chess-api"}`

Tasarım dokümanı: [docs/superpowers/specs/2026-05-28-cocuk-satranc-app-design.md](docs/superpowers/specs/2026-05-28-cocuk-satranc-app-design.md)
Implementation planları: [docs/superpowers/plans/](docs/superpowers/plans/)

## Stack

- **Frontend:** Next.js 15 + React 19 + TypeScript + TailwindCSS 3 (PWA)
- **Backend:** Python FastAPI + SQLAlchemy 2 + Alembic
- **Veri:** PostgreSQL 16, Redis 7
- **Satranç:** react-chessboard, chess.js, Stockfish.js (WASM bot — V1 Plan 5'te entegre olacak)
- **Deploy:** Vercel (frontend), Railway (backend + DB + Redis)
- **CI:** GitHub Actions (web + api + e2e)
- **Test:** Vitest (frontend), pytest (backend), Playwright (E2E)

## Pedagojik Yaklaşım

Zafer Bey (satranç hocası) ile 11 soruluk anket üzerinden belirlenmiş:
- Klasik müfredat: taşlar → değer → tehdit → saldırı/savunma → şah → mat (9 modül)
- Konu anlatımı sırasında inline "şimdi sen dene" alıştırmaları
- Aralıklı tekrar (SRS, SM-2 varyantı)
- Rozet + rütbe ile motivasyon (25+ rozet, 6 rütbe)
- Bot + insan oyunu + standalone Lichess CC0 puzzle havuzu

## Repo Yapısı

```
chess-app/
├── apps/
│   ├── web/        # Next.js PWA (Vercel'de deploy)
│   └── api/        # Python FastAPI (Railway'de deploy)
├── e2e/            # Playwright E2E testleri
├── docs/
│   └── superpowers/
│       ├── specs/  # Tasarım dokümanı
│       └── plans/  # 8 sıralı implementation planı
└── .github/
    └── workflows/  # CI: web + api + e2e
```

## Yerel Geliştirme

### Gereksinimler
- Node.js 22+
- Python 3.12+
- PostgreSQL 16 (lokal opsiyonel, Railway dev DB kullanılabilir)
- Redis 7 (lokal opsiyonel)

### Kurulum

```bash
# Repo
git clone https://github.com/yigitankuva-design/chess-app.git
cd chess-app

# Web (terminal 1)
npm install                # workspace root, hepsini kurar
cd apps/web
npm run dev                # http://localhost:3000

# API (terminal 2)
cd apps/api
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash; PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn chess_api.main:app --reload   # http://localhost:8000
```

### Test

```bash
# Frontend unit (Vitest)
cd apps/web && npm test

# Backend (pytest)
cd apps/api && pytest tests/ -v

# E2E (Playwright) — web dev sunucu açıkken
cd e2e && npm test
```

## Yol Haritası

V1 — 8 sıralı plan, ~5 ay:

- [x] **Plan 1: Foundation/Scaffold** — Repo, deploy hattı, /health (1-2 hafta)
- [ ] Plan 2: Auth + Identity — Veli/öğretmen kayıt, çocuk PIN (2 hafta)
- [ ] Plan 3: Müfredat + Lesson Player — 9 modül, 45 ders (3 hafta)
- [ ] Plan 4: Puzzle + SRS — Lichess CSV import, aralıklı tekrar (2 hafta)
- [ ] Plan 5: Bot + Gamification — Stockfish.js, rozet, rütbe, avatar (2 hafta)
- [ ] Plan 6: İnsan Oyunu + WebSocket — Eşleştirme, canlı oyun (2 hafta)
- [ ] Plan 7: Veli Paneli — Dashboard, süre sınırı, haftalık email (2 hafta)
- [ ] Plan 8: Öğretmen + Polish + Lansman — Sınıf, ödev, modül-quiz, KVKK, beta (2 hafta)

Her plan kendi `docs/superpowers/plans/` dosyasında detaylı bite-sized adımlar olarak yazılmış.

## Lisans

TBD (V1 lansman öncesi kararlaştırılacak).
