# Çocuklar İçin Satranç Öğretim Uygulaması

8-14 yaş çocuklara satranç öğreten PWA. Birincil hedef: 8-12 yaş.

## Mevcut Durum

🎨 **Tasarım fazı tamamlandı** — Implementation planı bekliyor.

Tasarım dokümanı: [docs/superpowers/specs/2026-05-28-cocuk-satranc-app-design.md](docs/superpowers/specs/2026-05-28-cocuk-satranc-app-design.md)

## Stack (planlanan)

- **Frontend:** Next.js 15 + React 19 + TypeScript + TailwindCSS (PWA)
- **Backend:** Python FastAPI + PostgreSQL + Redis
- **Satranç:** react-chessboard, chess.js, Stockfish.js (WASM bot)
- **Deploy:** Vercel (frontend), Railway (backend + DB + Redis)
- **İçerik:** Lichess CC0 Puzzle DB (~80-120K problem)

## Pedagojik Onay

Zafer Bey (satranç hocası) ile 11 soruluk anket sonrası belirlenen:
- Klasik müfredat: taşlar → değer → tehdit → saldırı/savunma → şah → mat
- Konu anlatımı sırasında inline "şimdi sen dene" alıştırmaları
- Aralıklı tekrar (SRS)
- Rozet + rütbe ile motivasyon
- Bot + insan oyunu + standalone problemler

## Sonraki Adım

`superpowers:writing-plans` ile 20 haftalık implementation planı.
