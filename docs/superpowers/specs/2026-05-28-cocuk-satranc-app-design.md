# Çocuklar İçin Satranç Öğretim Uygulaması — Tasarım Dokümanı

**Tarih:** 28 Mayıs 2026
**Durum:** Onaylanmış tasarım — implementation planına geçilebilir
**Versiyon:** 1.0
**Sahipler:** Muham (ürün/geliştirici), Zafer Bey (pedagojik danışman/öğretmen)

---

## 1. Özet

8-14 yaş arası çocuklara satranç öğreten bir PWA (Progressive Web App). Birincil hedef bant 8-12 yaş. Çocuk, veli ve öğretmen olmak üzere üç farklı kullanıcı tipini destekler. Tamamen ücretsiz, Türkçe, V1 için ~5 ay geliştirme.

**Temel pedagojik yaklaşım** (Zafer Bey ile belirlendi):
- Klasik kitap tarzı müfredat (taşlar → değer → tehdit → saldırı/savunma → şah → mat)
- Konu anlatımı sırasında inline "şimdi sen dene" alıştırmaları (Chess.com modeli)
- Aralıklı tekrar (Spaced Repetition) ile kalıcılık
- Rozet + rütbe ile motivasyon
- Bot + insan oyunu + standalone problemler ile zengin pratik

**Teknik özet:** Next.js PWA + FastAPI backend + PostgreSQL + Redis + Stockfish.js. Tek codebase, tek deploy, mevcut Railway/Vercel altyapısı.

---

## 2. Hedefler ve Hedef Kitle

### Birincil hedef kitle
- **Çocuk:** 8-12 yaş, satrancı sıfırdan veya temel seviyeden başlayan
- **Veli:** Çocuğu için hesap açan, ilerlemeyi takip etmek isteyen
- **Öğretmen:** Sınıfını yöneten satranç hocası (ilk müşteri: Zafer Bey)

### İkincil hedef kitle (V1 sonrası)
- 6-9 yaş (mikro dersler ile genişleme)
- 13-14 yaş (ileri taktik modülleri ile genişleme)

### Başarı kriterleri (V1 lansman)
- Zafer Bey'in en az 5 öğrencisi düzenli kullanıyor
- Çocuk Modül 1'i 1 hafta içinde bitirebiliyor
- Veli paneli haftalık özet alıyor, etkileşime giriyor
- Sistem 50 eşzamanlı kullanıcıyı sorunsuz taşıyor

---

## 3. Zafer Bey'in Pedagojik Girdileri

11 soruluk Telegram anketi (Mayıs 27, 2026) ile alınan yanıtlar:

| # | Konu | Karar |
|---|---|---|
| 1 | Yaş alt aralığı | Hepsi hedef, **MVP için 8-12 öncelik** |
| 2 | Başlangıç varsayımı | **Sıfır seviye**; taş hareketleri 1 ay sürer |
| 3 | Müfredat | **Klasik kitap tarzı** (taş bazlı kademeli değil) |
| 4 | Ders süresi | **Karma**, 8-10 yaş için **~10 dk** ideal |
| 5 | Konu→Problem akışı | **B: Inline "şimdi sen dene"** — anında geri bildirim + konsantrasyon |
| 6 | Yanlış cevap | **A: "Yanlış, tekrar dene"** — kademeli ipucu yok |
| 7 | Konu sırası | 9 başlık (aşağıda) |
| 8 | Aralıklı tekrar | **Çok faydalı (A)** — tekrarsız ~1 hafta hatırlama |
| 9 | Motivasyon | **A + C: Rozetler + Seviye/rütbe** |
| 10 | Oyun | **D: Hepsi** (ders + problem + bot + insan), haftada 6+ saat |
| 11 | Veli rolü | **D: Veli + öğretmen ayrı paneller** |

### Zafer Bey'in 9 modül müfredatı (sıralı)
1. Satranç taşları ve hareketleri
2. Taşların değerleri
3. Tehdit
4. Taş alma
5. Saldırı ve savunma yöntemleri
6. Şah çekme
7. Şah çekme türleri
8. Şah tehdidinden korunma türleri
9. Mat ve temel mat türleri

---

## 4. Mimari Genel Bakış

3 katmanlı modüler monolit yaklaşımı:

```
┌─────────────────────────────────────────────────────────────┐
│                   PWA (Next.js + React)                      │
│  [Çocuk UI] [Veli paneli] [Öğretmen paneli] [Auth ekranları] │
│  Tahta + Stockfish.js bot + LessonPlayer + PuzzleSolver     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS REST + WebSocket
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend (Python FastAPI)                        │
│  [auth] [lesson] [puzzle] [srs] [game]                       │
│  [gamification] [parent] [teacher]                           │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│   PostgreSQL (kullanıcılar, ilerleme, içerik)                │
│   Redis (cache, oturum, eşleştirme kuyruğu)                  │
│   Object storage (statik dersler, animasyonlar)              │
└─────────────────────────────────────────────────────────────┘
```

### Mimari kararlar
- **Modüler monolit**: Backend modülleri ayrı servis değil, ayrı klasörler. İleride birini ayırmak gerekirse temizce çıkarılabilir.
- **Lichess bağımlılığı yok**: Puzzle DB bir kerelik import edilir; runtime'da hiç Lichess çağrısı yok.
- **Tarayıcıda bot**: Stockfish.js WebWorker'da çalışır, sunucu hiç bot hamlesi hesaplamaz.
- **Server-side validation**: Çocuk PWA hamle yapar, backend `python-chess` ile doğrular (anti-hile).

---

## 5. Kullanıcı Tipleri ve Akışlar

### Veli (hesap sahibi — kayıt buradan başlar)
```
Anasayfa → "Çocuğum için kayıt" → e-posta + şifre → e-posta doğrula
→ Veli profili → Çocuk profili ekle → Çocuğa 4 haneli PIN seç
→ Cihaz onayı (cihaz-bazlı PIN sistemi)
```

**Veli paneli her giriş:**
- Çocuğun bu hafta ne öğrendi
- Toplam süre, günlük kullanım grafiği
- Son rozet/rütbe atamaları
- Süre sınırı ayarla
- Anket/etkinlik katılım
- Birden fazla çocuk eklenebilir

### Çocuk
```
Uygulama aç → Çocuk profili seç → PIN gir (cihaz-bazlı)
→ Anasayfa: "Bugün devam et", "Sırada gelen ders", "Hızlı oyun", "Arkadaşla oyna"
```

**Tipik günlük akış (10-15 dk):**
1. Ders devam ettir → 10 dk içerik + 3-5 inline alıştırma
2. SRS tekrarı → 5-7 dakika önceki konu puzzle'ları
3. Ödüller (rozet, XP, rütbe ilerlemesi)
4. Hızlı bot oyunu (opsiyonel)

### Öğretmen (Zafer Bey + ileride başkaları)
```
Öğretmen girişi → Sınıf oluştur → Davet kodu ile öğrenci/veli ekle
→ Sınıf detayı + ödev verme + lider tablo + bireysel yorum
```

### Cihaz-bazlı PIN sistemi (onaylanmış karar)
- Veli telefon/tablete bir kerelik kurar
- Çocuk o cihazda 4 haneli PIN ile girer
- Başka cihazda yeniden veli onayı gerekir
- Çocuk hesabı dışarıda erişilebilir değil → güvenlik üst düzey

---

## 6. Veri Modeli

PostgreSQL'de 5 mantıksal grup, ~22 tablo.

### A. Kimlik & Hesap
```
User (parent | teacher)
  id, email, password_hash, role, name, created_at

ChildProfile
  id, parent_user_id, display_name, age, avatar, pin_hash,
  teacher_user_id (opsiyonel), last_active_at

Device
  id, parent_user_id, device_fingerprint, name,
  trusted_at, last_seen_at, active_child_profile_id
```

### B. Müfredat
```
Module
  id, order_index, name, description, icon

Lesson
  id, module_id, order_index, title, estimated_minutes

LessonStep
  id, lesson_id, order_index,
  type (explanation | inline_exercise | quiz),
  content_json, correct_answer_json

Puzzle
  id, lichess_id, fen, moves_json, rating,
  themes_json, popularity, module_id

PuzzleTheme
  id, slug, name_tr, description_tr
```

### C. İlerleme & Oyunlaştırma
```
ChildLessonProgress
  child_id, lesson_id, status (locked|in_progress|completed),
  completed_at, total_time_seconds, current_step_index

ChildLessonStepResult
  child_id, lesson_step_id, attempts_count,
  success_at_attempt, time_seconds

ChildPuzzleAttempt
  child_id, puzzle_id, success, time_seconds, attempted_at

SRSCard
  id, child_id, item_type (lesson_step | puzzle), item_id,
  due_at, interval_days, ease_factor, reps_count, last_result

Badge
  id, slug, name_tr, description_tr, icon, criteria_json

ChildBadge
  child_id, badge_id, earned_at

Rank
  id, order_index, name_tr, xp_required, icon

ChildRank
  child_id, current_rank_id, xp_total
```

### D. Oyun
```
Game
  id, type (bot | human), white_child_id, black_child_id,
  black_bot_level (Stockfish 0-20), status, result,
  started_at, finished_at, pgn

GameMove
  game_id, ply, san, fen_after, time_left_seconds, by_child_id

(MatchmakingQueue — Redis, PostgreSQL değil)
```

### E. Veli & Sınıf
```
Class
  id, teacher_user_id, name, join_code

ClassAssignment
  id, class_id, target_module_id, target_lesson_id, due_date

ParentTimeLimit
  child_id, daily_minutes_limit, reset_hour

ParentSurvey
  id, title, questions_json, created_by_teacher_id, target_class_id

ParentSurveyResponse
  survey_id, parent_user_id, child_id, answers_json
```

### Önemli notlar
- Çocuk hesabı `User` değil, veliye bağlı `ChildProfile`. Veli olmadan çocuk olmaz.
- PIN bcrypt ile hash'lenir.
- SRS algoritması SM-2 varyantı (Anki'nin de kullandığı).
- Lichess Puzzle DB'den ~80-120K problem (rating 400-1400 bandı) import edilir.

---

## 7. Müfredat İçeriği

### Modül × Ders dağılımı (V1: 45 ders)

| # | Modül | Ders | Lichess tema |
|---|---|---|---|
| 1 | Taşlar ve hareketleri | 9 | (puzzle yok — tanıma odaklı) |
| 2 | Taşların değerleri | 4 | equality, advantage |
| 3 | Tehdit | 5 | attraction, attacking, defensiveMove |
| 4 | Taş alma | 4 | capturingDefender, hangingPiece, xRayAttack |
| 5 | Saldırı/savunma | 5 | kingsideAttack, defensiveMove, sacrifice |
| 6 | Şah çekme | 4 | check, doubleCheck, discoveredAttack |
| 7 | Şah çekme türleri | 4 | doubleCheck, discoveredAttack |
| 8 | Şah'tan korunma | 4 | interference, blocking, kingMove |
| 9 | Mat ve temel matlar | 6 | mateIn1, mateIn2, mateIn3, backRankMate, smotheredMate |

### Ders yapısı (her ders ~10 dk, 6-8 step)
```
[Step 1] 📺 Açıklama (90sn) — konsept tanımı
[Step 2] 📺 Örnek pozisyon (60sn) — animasyon
[Step 3] 🎯 İnline alıştırma 1 — KOLAY
[Step 4] 📺 Derinleştir (90sn)
[Step 5] 🎯 İnline alıştırma 2 — ORTA
[Step 6] 📺 Edge case (60sn)
[Step 7] 🎯 İnline alıştırma 3 — ZOR
[Step 8] 🏁 Kapanış (30sn) + 5 standalone problem
```

### Lichess Puzzle DB import stratejisi
1. CC0 CSV indir (~1GB, 4M+ problem)
2. Filtrele: rating 400-1400, "olmazsa olmaz" temalar, popülerlik üstü
3. 9 modüle otomatik eşle (tema → modül mapping)
4. PostgreSQL'e batch insert (~80-120K puzzle)
5. İleride Zafer Bey seçtikleri eklenir

### Türkçe tema çevirileri (örnek)
- fork → Çatal | pin → Çivi | skewer → Şiş
- discoveredAttack → Açma saldırısı | mateIn1 → Tek hamlede mat
- backRankMate → Son sıra matı | smotheredMate → Boğma matı
- sacrifice → Fedakarlık | hangingPiece → Asılı taş

### İçerik üretim iş bölümü
- **Geliştirici (Muham):** Lichess import + tema mapping kodu, ders metni şablonu, animasyon framework
- **Açık kaynak:** Tahta animasyonları (chessboard.js, react-chessboard), satranç motoru (chess.js)
- **Çeviri:** Lichess tema isimleri TR, açık satranç kitaplarından konsept açıklamaları
- **Zafer Bey (V1 sonrası):** Mevcut metinleri okur, düzeltir, eklemeler önerir

---

## 8. Teknik Stack

### Frontend (PWA)
| Katman | Seçim |
|---|---|
| Framework | Next.js 15 + React 19 (App Router) |
| Dil | TypeScript |
| Stil | TailwindCSS + shadcn/ui |
| Satranç tahtası | react-chessboard |
| Oyun mantığı | chess.js |
| Bot motoru | Stockfish.js (WASM, WebWorker) |
| Animasyon | Framer Motion |
| State | Zustand + TanStack Query |
| Form | react-hook-form + zod |
| PWA | next-pwa |

### Backend
| Katman | Seçim |
|---|---|
| Dil | Python 3.12+ |
| Framework | FastAPI |
| ORM | SQLAlchemy 2.0 + Alembic |
| Validasyon | Pydantic v2 |
| Auth | python-jose (JWT) + passlib (bcrypt) |
| Satranç (server) | python-chess |
| Real-time | FastAPI WebSocket |
| Background | APScheduler |
| Email | fastapi-mail + SendGrid |

### Veri & Cache
| Servis | Plan |
|---|---|
| PostgreSQL 16 | Railway managed (~$5/ay) |
| Redis 7 | Railway add-on |
| Object storage | Cloudflare R2 veya Vercel Blob |

### DevOps
| Servis | Maliyet |
|---|---|
| GitHub | Ücretsiz |
| Vercel (frontend) | Ücretsiz tier |
| Railway (backend + DB + Redis) | ~$5/ay |
| Sentry | Free tier |
| SendGrid | Free tier (100/gün) |
| Cloudflare CDN | Ücretsiz |

### Test
- Frontend: Vitest + Testing Library
- Backend: pytest + pytest-asyncio
- E2E: Playwright

### Toplam V1 aylık maliyet: ~$5-7/ay

---

## 9. Ana Bileşenler ve API'ler

### Frontend route yapısı
```
app/
├── (auth)/     - parent-signup, parent-login, teacher-login,
│                  device-setup, child-pin
├── (child)/    - home, lesson/[id], puzzle, srs, play,
│                  badges, profile
├── (parent)/   - dashboard, child/[id], time-limit, survey,
│                  add-child
└── (teacher)/  - classes, class/[id], assignment, analytics
```

### Yeniden kullanılabilir komponentler
- `<ChessBoard />` — Dokunmatik destekli tahta
- `<LessonPlayer />` — Step bazlı ders oynatıcı
- `<PuzzleSolver />` — FEN'den problem çözüm UI
- `<BotEngine />` — Stockfish.js WebWorker sarmalayıcı
- `<GameTimer />` — Süre kontrolü
- `<XPBar />` — Rütbe ilerlemesi
- `<BadgeToast />` — Rozet popup

### Backend modülleri (tek FastAPI app)
```
chess_app/
├── modules/
│   ├── auth/          - POST /auth/*
│   ├── lesson/        - GET /modules, /lessons/*
│   ├── puzzle/        - GET /puzzles/*
│   ├── srs/           - SRS due + review
│   ├── game/          - bot + human game, WebSocket
│   ├── gamification/  - Badge + rank engine (internal)
│   ├── parent/        - Dashboard, time-limit, survey
│   └── teacher/       - Class management
├── models/            - SQLAlchemy
├── schemas/           - Pydantic
├── services/          - İş mantığı
├── workers/           - SRS scheduler, daily reset
└── scripts/
    ├── import_puzzles.py
    └── seed_curriculum.py
```

### Kritik endpoint'ler
```
POST /auth/parent/signup
POST /auth/parent/login
POST /auth/device/register
POST /auth/child/pin

GET  /modules
GET  /lessons/{id}
POST /lessons/{id}/step/{step_id}/answer
POST /lessons/{id}/complete

GET  /puzzles/random?theme=fork&module=3
POST /puzzles/{id}/attempt

GET  /srs/due
POST /srs/{card_id}/review

POST /games/bot/start?skill=5
POST /games/match/queue
WS   /ws/game/{game_id}
WS   /ws/queue

GET  /parent/children
POST /parent/children/{id}/time-limit

GET  /teacher/classes
POST /teacher/classes/{id}/assignments
```

---

## 10. V1 MVP Kapsamı

### V1'de OLACAK
**Çocuk:**
- 9 modüllük müfredat, 45 ders
- Inline alıştırmalar
- SRS (1-3-7-14 gün)
- Standalone problem havuzu (Lichess import)
- Bot oyunu (Stockfish 5 zorluk seviyesi)
- İnsan vs insan oyunu (matchmaking + WebSocket)
- 25-30 rozet
- Rütbe sistemi (Piyon→At→Fil→Kale→Vezir→Şah)
- Avatar seçimi (4-5 seçenek)
- Günlük challenge (günün problemi)
- Modül-sonu mini-quiz (Modül 1 ve 9'da Zafer Bey istedi, hepsine ekleniyor)
- Geçmiş (oyunlar + problemler)

**Veli:**
- Birden fazla çocuk hesap yönetimi
- Cihaz onayı + PIN sistemi
- Haftalık özet (panelde + e-posta otomatik)
- Süre sınırı uygulaması
- Anket/etkinlik katılımı

**Öğretmen:**
- Sınıf oluşturma + davet kodu
- Sınıf görünümü
- Ödev verme
- Lider tablo
- Bireysel yorum
- Anket gönderme

**Sistem:**
- PWA (telefon/tablet kurulabilir)
- Türkçe (tek dil)
- KVKK uyumu
- Cookie-free analytics

### V1'de OLMAYACAK (V1.5/V2'ye)
- Çocuklar arası mesajlaşma (güvenlik)
- Büyük turnuvalar
- Açılış teorisi
- İleri son oyun (K+P vs K vb.)
- Çoklu dil (İng/Rus/Ar)
- Native iOS/Android (PWA yeter, V2)
- Sesli komut
- Canlı video kursları
- AI satranç koçu (Aimchess benzeri)
- Push notification (V1.5)
- 6-9 ve 13-14 yaş ayrı içerik (V2 genişleme)

---

## 11. Takvim (5 ay, 20 hafta)

| Hafta | Sprint hedefleri |
|---|---|
| 1-2 | Kurulum: repo, deploy, auth iskeleti, Lichess DB import |
| 3-4 | Veri modeli + Alembic migration'lar, puzzle import, lesson içerik şeması |
| 5-7 | ChessBoard + LessonPlayer komponentleri, ilk 9 dersi (Modül 1) tamamla |
| 8-10 | PuzzleSolver + SRS algoritma, tüm 45 dersin içeriği |
| 11-12 | Bot oyunu (Stockfish.js), rozet/rütbe sistemi, avatar |
| 13-14 | İnsan vs insan oyunu, WebSocket + matchmaking |
| 15-16 | Veli paneli, süre sınırı, haftalık email |
| 17-18 | Öğretmen paneli, sınıf yönetimi, ödev |
| 19 | Modül-sonu quiz + günlük challenge |
| 20 | QA, E2E, beta test (Zafer Bey sınıfı), lansman |

---

## 12. Riskler ve Azaltma

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| İçerik üretim hızı | Yüksek | Yüksek | Şablon, Modül 1'de pattern netleştir |
| Çocuk UX'i denenmemiş | Yüksek | Yüksek | Hafta 8'de 2-3 öğrenciyle erken test |
| Stockfish.js eski tarayıcıda yavaş | Orta | Orta | Düşük seviye = kural-tabanlı bot |
| Lichess CSV DB performansı | Düşük | Orta | Sadece 400-1400 rating, index'le |
| WebSocket Railway free limit | Düşük | Orta | Eşleştirme sınırlı, premium tier hazır |
| KVKK uyum | Düşük | Yüksek | Veli onayı zorunlu, V1 sonu hukuki kontrol |
| SendGrid 100/gün aşılır | Düşük | Düşük | Mailgun yedek |

---

## 13. V1 Sonrası Yol Haritası

### V1.5 (1-2 ay sonra)
- 6-9 yaş özel basit içerik (mikro dersler)
- Push notification
- Açılış teorisi modülü
- AI satranç koçu (Claude ile oyun analizi)

### V2 (4-6 ay sonra)
- İngilizce, Rusça, Arapça
- Native iOS + Android (Capacitor ile PWA paketleme)
- 13-14 yaş ileri taktik
- Turnuvalar
- Çocuklar arası "follow" (mesajsız)
- Veri analitik (öğretmen için derin)

---

## 14. Açık Sorular / Karar Bekleyenler

- **GitHub repo adı:** Önerilmiş "chess-app" ama kesin değil; lansman öncesi marka adı kararlaştırılmalı
- **Domain:** Opsiyonel, başlangıçta `app-adi.vercel.app` yeterli; ileride alınabilir
- **KVKK uzmanı:** V1 lansman öncesi danışman gerekecek
- **Beta test grubu:** Zafer Bey'in sınıfından 5-10 öğrenci/veli — kim olduğu netleştirilmeli (Hafta 15-20)
- **Stockfish "kolay" bot:** Skill 0 yeterince kolay mı, yoksa özel kural-tabanlı mı yazılmalı?
- **Avatar seti:** 4-5 avatar görseli kim çizecek/temin edecek?
- **İçerik ses kaydı:** Ders metinleri için sesli anlatım eklenecek mi (V1.5'e bırakılabilir)?

---

## 15. Onay & Sahipler

- **Tasarım onayı:** Muham (28 Mayıs 2026)
- **Pedagojik onay:** Zafer Bey (anket cevapları, 27 Mayıs 2026)
- **Sonraki adım:** `superpowers:writing-plans` skill ile 20 haftalık implementation planı oluşturulacak

---

*Bu doküman canlı bir spec'tir — V1 ilerleyişine göre güncellenir. Major değişiklikler için yeni revizyon, küçük düzeltmeler inline.*
