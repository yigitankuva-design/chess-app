# Plan 8: Öğretmen Paneli + Polish + Lansman Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Öğretmen paneli (sınıf yönetimi, ödev verme, lider tablosu, anket oluşturma), modül-sonu mini-quiz sistemi, son polish + Zafer Bey'in sınıfıyla beta test + V1 lansman hazırlığı.

**Architecture:** `Class`, `ClassAssignment` modelleri + öğretmen yetkilendirmesi. Modül-sonu quiz altyapısı (her modülün son lesson'ı `quiz` type). Cross-cutting polish: performans, accessibility, dark mode, KVKK uyum.

**Tech Stack:** Aynı stack — yeni teknoloji yok. Genel hassasiyet ve QA odaklı.

**Bağımlılık:** Plan 7 yeşil.
**Süre tahmini:** 2 hafta

---

## File Structure

```
apps/api/chess_api/
├── models/
│   └── class.py            # Class, ClassAssignment
├── routers/
│   └── teacher.py
├── services/
│   ├── class_management.py
│   └── leaderboard.py
└── scripts/
    └── seed_remaining_modules.py  # Modül 2-9'un içerik şablonu

apps/web/
├── components/
│   ├── ClassroomGrid.tsx
│   ├── AssignmentForm.tsx
│   ├── Leaderboard.tsx
│   ├── ModuleQuiz.tsx
│   └── KVKKConsentModal.tsx
└── app/(teacher)/
    ├── classes/page.tsx
    ├── class/[id]/page.tsx
    ├── assignment/page.tsx
    ├── survey-create/page.tsx
    └── analytics/page.tsx

docs/
├── LAUNCH_CHECKLIST.md
├── KVKK_PRIVACY.md
└── BETA_TEST_PLAN.md
```

---

## Task 1: Class Models + Migration

**Files:**
- Create: `apps/api/chess_api/models/class.py`

- [ ] **Step 1.1: `models/class.py`**

```python
from datetime import datetime, date
from sqlalchemy import String, Integer, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Class(Base):
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    join_code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ClassAssignment(Base):
    __tablename__ = "class_assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), index=True)
    target_module_id: Mapped[int | None] = mapped_column(ForeignKey("modules.id"), nullable=True)
    target_lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

ChildProfile model'inde `class_id` alanı zaten yok — eklenmeli:

```python
# models/child.py'a ekle
class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id"), nullable=True, index=True)
```

- [ ] **Step 1.2: Migration + commit**

```bash
alembic revision --autogenerate -m "create class and assignment tables"
alembic upgrade head
git commit -am "feat(teacher): Class + ClassAssignment models"
```

---

## Task 2: Teacher Routes

**Files:**
- Create: `apps/api/chess_api/routers/teacher.py`
- Create: `apps/api/chess_api/services/leaderboard.py`
- Modify: `apps/api/chess_api/main.py`

- [ ] **Step 2.1: `services/leaderboard.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from chess_api.models import ChildProfile, ChildRank, Rank


async def class_leaderboard(db: AsyncSession, class_id: int) -> list[dict]:
    q = (
        select(ChildProfile, ChildRank, Rank)
        .where(ChildProfile.class_id == class_id)
        .join(ChildRank, ChildRank.child_id == ChildProfile.id, isouter=True)
        .join(Rank, ChildRank.current_rank_id == Rank.id, isouter=True)
        .order_by(ChildRank.xp_total.desc().nullslast())
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "child_id": c.id,
            "display_name": c.display_name,
            "avatar": c.avatar,
            "xp_total": cr.xp_total if cr else 0,
            "rank_name": r.name_tr if r else "Piyon",
        }
        for c, cr, r in rows
    ]
```

- [ ] **Step 2.2: `routers/teacher.py`**

```python
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, UserRole, Class, ClassAssignment, ChildProfile, ParentSurvey
from chess_api.services.leaderboard import class_leaderboard
from pydantic import BaseModel


class CreateClassRequest(BaseModel):
    name: str


class CreateAssignmentRequest(BaseModel):
    title: str
    description: str | None = None
    target_module_id: int | None = None
    target_lesson_id: int | None = None
    due_date: str | None = None  # ISO date


class CreateSurveyRequest(BaseModel):
    title: str
    questions: list[dict]  # [{type, prompt, options}, ...]


router = APIRouter(prefix="/teacher", tags=["teacher"])


def _ensure_teacher(u: User):
    if u.role != UserRole.teacher:
        raise HTTPException(403, "Teachers only")


@router.get("/classes")
async def list_classes(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    result = await db.execute(
        select(Class).where(Class.teacher_user_id == current.id)
    )
    return [
        {"id": c.id, "name": c.name, "join_code": c.join_code}
        for c in result.scalars().all()
    ]


@router.post("/classes", status_code=201)
async def create_class(
    payload: CreateClassRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = Class(
        teacher_user_id=current.id,
        name=payload.name,
        join_code=secrets.token_urlsafe(4)[:8].upper(),
    )
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    return {"id": cls.id, "name": cls.name, "join_code": cls.join_code}


@router.get("/classes/{class_id}/students")
async def class_students(
    class_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    result = await db.execute(
        select(ChildProfile).where(ChildProfile.class_id == class_id)
    )
    return [
        {"id": c.id, "display_name": c.display_name, "avatar": c.avatar, "age": c.age}
        for c in result.scalars().all()
    ]


@router.post("/classes/{class_id}/assignments", status_code=201)
async def create_assignment(
    class_id: int,
    payload: CreateAssignmentRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    from datetime import date as date_type
    assignment = ClassAssignment(
        class_id=class_id,
        title=payload.title,
        description=payload.description,
        target_module_id=payload.target_module_id,
        target_lesson_id=payload.target_lesson_id,
        due_date=date_type.fromisoformat(payload.due_date) if payload.due_date else None,
    )
    db.add(assignment)
    await db.commit()
    return {"id": assignment.id}


@router.get("/classes/{class_id}/leaderboard")
async def get_leaderboard(
    class_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    return await class_leaderboard(db, class_id)


@router.post("/surveys", status_code=201)
async def create_survey(
    payload: CreateSurveyRequest,
    target_class_id: int | None = None,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    survey = ParentSurvey(
        title=payload.title,
        questions_json=payload.questions,
        created_by_teacher_id=current.id,
        target_class_id=target_class_id,
    )
    db.add(survey)
    await db.commit()
    return {"id": survey.id}
```

- [ ] **Step 2.3: Veli join code ile çocuğu sınıfa ekleme endpoint'i (parent router'a)**

```python
# routers/parent.py'ye ekle:
@router.post("/children/{child_id}/join-class")
async def join_class(
    child_id: int,
    join_code: str,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    child = await db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != current.id:
        raise HTTPException(403)
    cls_q = await db.execute(select(Class).where(Class.join_code == join_code.upper()))
    cls = cls_q.scalar_one_or_none()
    if not cls:
        raise HTTPException(404, "Class not found")
    child.class_id = cls.id
    child.teacher_user_id = cls.teacher_user_id
    await db.commit()
    return {"joined": True, "class_name": cls.name}
```

- [ ] **Step 2.4: Test + commit**

```bash
git commit -am "feat(teacher): class management endpoints + join code"
```

---

## Task 3: Teacher Frontend Pages

**Files:**
- Create: `apps/web/app/(teacher)/classes/page.tsx`
- Create: `apps/web/app/(teacher)/class/[id]/page.tsx`
- Create: `apps/web/components/ClassroomGrid.tsx`
- Create: `apps/web/components/AssignmentForm.tsx`
- Create: `apps/web/components/Leaderboard.tsx`

- [ ] **Step 3.1: `app/(teacher)/classes/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Klass { id: number; name: string; join_code: string; }

export default function ClassesPage() {
  const [classes, setClasses] = useState<Klass[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  async function load() {
    const token = localStorage.getItem('chess_app_token');
    const res = await fetch('/api/backend/teacher/classes', {
      headers: { Authorization: `Bearer ${token}` },
    });
    setClasses(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function createClass() {
    const token = localStorage.getItem('chess_app_token');
    await fetch('/api/backend/teacher/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName }),
    });
    setNewName(''); setCreating(false); load();
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Sınıflarım</h1>
      <button
        onClick={() => setCreating(true)}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >+ Yeni Sınıf</button>
      {creating && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg space-y-2">
          <input
            value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Sınıf adı"
            className="w-full p-2 border rounded"
          />
          <button onClick={createClass} className="px-3 py-1 bg-green-600 text-white rounded">
            Oluştur
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {classes.map(c => (
          <Link key={c.id} href={`/class/${c.id}`} className="block p-4 bg-white rounded-lg shadow hover:shadow-lg">
            <h2 className="text-xl font-bold">{c.name}</h2>
            <p className="text-sm opacity-75">Katılım kodu: <code className="font-mono">{c.join_code}</code></p>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3.2: `app/(teacher)/class/[id]/page.tsx`**

Class detay sayfası:
- Öğrenci grid'i (ClassroomGrid)
- Ödev verme tab'ı (AssignmentForm)
- Lider tablosu tab'ı (Leaderboard)
- Anket gönderme tab'ı

(Tab UI + her bileşeni embed.)

- [ ] **Step 3.3: ClassroomGrid, AssignmentForm, Leaderboard component'leri**

Standart React component'leri, fetch + render pattern'i Plan 7'deki dashboard ile aynı.

- [ ] **Step 3.4: Commit**

```bash
git commit -am "feat(teacher): classes + class detail UI"
```

---

## Task 4: Modül-sonu Mini-quiz

**Files:**
- Modify: `apps/api/scripts/curriculum-data.json` (her modül için son lesson `type=quiz`)
- Create: `apps/web/components/ModuleQuiz.tsx`
- Modify: `LessonPlayer` (quiz type'ı destekle)

- [ ] **Step 4.1: Curriculum verisini güncelle**

Her modülün son lesson'ı 5-10 quiz step'i içersin. Quiz step yapısı:

```json
{
  "order": 5, "type": "quiz",
  "content": {
    "title": "Modül 1 Sınavı",
    "questions": [
      {
        "prompt": "Atın hareketi hangisi?",
        "fen": "8/8/8/8/4N3/8/8/8 w - - 0 1",
        "options": ["L şekli (2+1)", "Diyagonal", "Düz", "Tek kare"],
        "correct_index": 0
      }
    ]
  },
  "correct_answer": { "correct_indexes": [0, ...] }
}
```

- [ ] **Step 4.2: `components/ModuleQuiz.tsx`**

```tsx
'use client';
import { useState } from 'react';

interface Question {
  prompt: string; fen?: string;
  options: string[]; correct_index: number;
}

interface Props {
  questions: Question[];
  onComplete: (score: number, max: number) => void;
}

export function ModuleQuiz({ questions, onComplete }: Props) {
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);

  function answer(qIdx: number, optIdx: number) {
    const next = [...answers];
    next[qIdx] = optIdx;
    setAnswers(next);
  }

  function submit() {
    const score = questions.reduce((s, q, i) => s + (answers[i] === q.correct_index ? 1 : 0), 0);
    setSubmitted(true);
    onComplete(score, questions.length);
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div key={i} className="p-4 bg-white rounded-lg shadow">
          <p className="font-bold mb-3">Soru {i + 1}: {q.prompt}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => answer(i, oi)}
                disabled={submitted}
                className={`block w-full text-left p-3 rounded border ${
                  answers[i] === oi
                    ? submitted
                      ? oi === q.correct_index ? 'bg-green-200 border-green-500' : 'bg-red-200 border-red-500'
                      : 'bg-blue-200 border-blue-500'
                    : 'border-gray-300'
                }`}
              >{opt}</button>
            ))}
          </div>
        </div>
      ))}
      {!submitted && (
        <button onClick={submit} className="w-full bg-blue-600 text-white py-3 rounded-lg">
          Sınavı Bitir
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4.3: LessonPlayer'ı quiz type için genişlet**

`if (currentStep.type === 'quiz')` dalı ekle, `<ModuleQuiz />` render et.

- [ ] **Step 4.4: Commit**

```bash
git commit -am "feat(curriculum): module-end mini quiz support"
```

---

## Task 5: Modül 2-9 İçerik (Bulk content production)

**Files:**
- Modify: `apps/api/scripts/curriculum-data.json` (Modül 2-9'un dersleri)

- [ ] **Step 5.1: Her modülün derslerini yaz**

8 modül × ~5 ders × ~6 step = ~240 step. Bu büyük bir içerik üretim turu. Şablon JSON'ı doldur, FEN'leri test et, doğru cevapları işaretle.

- [ ] **Step 5.2: Seed'i çalıştır + lokal manuel test**

```bash
python -m scripts.seed_curriculum
```

Tüm 45 dersi manuel oyna, hataları düzelt.

- [ ] **Step 5.3: Commit**

```bash
git commit -am "content(curriculum): all 45 lessons for V1 (Modules 2-9)"
```

---

## Task 6: Performans + Accessibility Polish

- [ ] **Step 6.1: Lighthouse audit**

```bash
cd apps/web
npm run build && npm start
# Browser'da Lighthouse → Performance, Accessibility, Best Practices, SEO
```

Hedefler:
- Performance ≥ 90
- Accessibility ≥ 95
- Best Practices ≥ 90

Yaygın düzeltmeler:
- Görseller `next/image` ile lazy load
- `alt` attribute'leri ekle (avatar/icon'larda)
- Color contrast (özellikle çocuk UI'da)
- Aria labels (butonlar/tahta)

- [ ] **Step 6.2: PWA manifest + service worker düzeltme**

`next-pwa` ile offline support: ders içerikleri cache'lensin.

```typescript
// next.config.mjs'a:
import withPWA from 'next-pwa';

const config = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
})({
  // ... existing config
});
```

- [ ] **Step 6.3: Dark mode (opsiyonel ama hoş)**

TailwindCSS'in `dark:` variant'ı zaten ortamı destekliyor. `useTheme` provider ekle.

- [ ] **Step 6.4: Commit**

```bash
git commit -am "polish: accessibility + PWA offline + dark mode"
```

---

## Task 7: KVKK / Hukuki Sayfalar

**Files:**
- Create: `apps/web/app/privacy/page.tsx`
- Create: `apps/web/app/terms/page.tsx`
- Create: `apps/web/components/KVKKConsentModal.tsx`
- Create: `docs/KVKK_PRIVACY.md`

- [ ] **Step 7.1: Gizlilik politikası taslağı**

KVKK uyumu için minimum:
- Hangi veriler toplanıyor (isim, e-posta, çocuğun yaşı, oyun verileri)
- Neden toplanıyor (eğitim, ilerleme takibi)
- Kimle paylaşılıyor (kimseyle, sadece veli/öğretmen)
- Saklama süresi (hesap silinene kadar)
- Çocuğun hakları (veli aracılığıyla)
- İletişim (e-posta)

`docs/KVKK_PRIVACY.md` + frontend'de `/privacy` route'a render.

- [ ] **Step 7.2: KVKK Consent Modal (veli kaydı sırasında)**

Veli signup form'unda zorunlu checkbox + linkten gizlilik politikası açılır.

- [ ] **Step 7.3: Çocuk veri silme akışı**

Veli panelinde "Çocuğu sil" butonu — child + tüm verileri cascade silinir.

```python
# parent router'a:
@router.delete("/children/{child_id}")
async def delete_child(
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    child = await db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != current.id:
        raise HTTPException(403)
    await db.delete(child)
    await db.commit()
    return {"deleted": True}
```

- [ ] **Step 7.4: Commit**

```bash
git commit -am "feat(legal): KVKK privacy policy + consent + child deletion"
```

---

## Task 8: Beta Test + Lansman

**Files:**
- Create: `docs/LAUNCH_CHECKLIST.md`
- Create: `docs/BETA_TEST_PLAN.md`

- [ ] **Step 8.1: Beta test planı yaz**

`docs/BETA_TEST_PLAN.md` içeriği:
- 5-10 öğrenci (Zafer Bey'in sınıfı)
- Süre: 2 hafta
- Beklenenler: Modül 1-3'ü bitirme, en az 30 puzzle çözme
- Veri toplama: günlük session length, completion rate, retention
- Veli geri bildirim formu
- Bug raporu kanalı (Telegram grubu veya WhatsApp)

- [ ] **Step 8.2: Lansman checklist**

`docs/LAUNCH_CHECKLIST.md`:
- [ ] Production DB migration uygulandı
- [ ] Tüm env vars Railway'de set
- [ ] CORS production domain'i içeriyor
- [ ] SSL sertifikası aktif (Vercel/Railway otomatik)
- [ ] Sentry hata izleme aktif, alarmlar set
- [ ] SendGrid prod hesabı, domain authentication
- [ ] Robots.txt + sitemap.xml
- [ ] Open Graph meta tags
- [ ] favicon + PWA icon'ları (192x192, 512x512)
- [ ] KVKK sayfası live
- [ ] Smoke test (production): tüm 3 user type tam flow
- [ ] Backup stratejisi (Railway PG günlük backup)
- [ ] Acil durum prosedürü (rollback)

- [ ] **Step 8.3: Beta'yı başlat**

Zafer Bey'in 5-10 öğrencisi ile WhatsApp'ta paylaş:
> "Çocukların satranç öğrenmek için kullanabileceği yeni bir uygulama yaptık. Linkten kayıt olabilirsiniz: <URL>. 2 hafta boyunca kullansınlar, görüşlerinizi bize aktarın."

- [ ] **Step 8.4: 2 hafta sonra geri bildirim toplama**

- Veli anketi gönder (Plan 7'deki survey sistemi)
- Sentry hata raporlarını incele
- Activity log'larından kullanım pattern'ı çıkar
- Beta sonrası bug fix turu (1 hafta)

- [ ] **Step 8.5: V1 Lansman**

- Beta sonrası kritik bug'lar yoksa public lansman
- Domain al (opsiyonel) — `cocuksatranc.com` veya benzeri
- Lichess Türkiye topluluğu, satranç federasyonları, blog yazısı

- [ ] **Step 8.6: Commit**

```bash
git commit -am "docs: launch checklist + beta test plan"
```

---

## ACCEPTANCE TESTS — Plan 8 Test Geçidi (V1 LANSMAN HAZIRLIĞI)

### Backend
- [ ] Teacher endpoint'leri (class, assignment, leaderboard, survey) → tüm testler yeşil
- [ ] Modül 2-9'un tüm dersleri DB'de seed edilmiş
- [ ] Quiz step'leri quiz response endpoint'iyle kaydediliyor

### Frontend
- [ ] Öğretmen `/classes`'ta sınıf oluşturur, join code'u görür
- [ ] Veli o join code'u kullanarak çocuğu sınıfa ekler
- [ ] Öğretmen sınıf detayda öğrencileri görür, ödev verir
- [ ] Öğretmen anket oluşturur, veli velilen panelden görür
- [ ] Modül 1 bitince mini-quiz açılır, çocuk cevaplar, skor gösterilir

### E2E Tam Akış
- [ ] **Veli akışı:** Kayıt → e-posta doğrula → çocuk ekle → cihaz onayla → çocuk profili oluştur
- [ ] **Çocuk akışı:** PIN ile gir → modül 1 ders 1 → 9'a kadar tamamla → quiz → modül 2'ye geç
- [ ] **Çocuk:** puzzle çöz, bot oyunu kazan, insan oyunu kazan → 5+ rozet kazan
- [ ] **Öğretmen akışı:** Sınıf oluştur → join code paylaş → öğrenciler katıl → ödev ver → leaderboard gör

### Performans
- [ ] Lighthouse Performance ≥ 90 (mobile)
- [ ] Lighthouse Accessibility ≥ 95
- [ ] First Contentful Paint < 2sn
- [ ] Time to Interactive < 4sn
- [ ] Tüm endpoint'ler p95 < 200ms

### Polish
- [ ] Dark mode düzgün çalışıyor
- [ ] PWA "Add to Home Screen" deneyimi pürüzsüz
- [ ] Offline'da daha önce yüklenen dersler oynanabilir
- [ ] Tüm metinler Türkçe, typo yok

### KVKK
- [ ] `/privacy` sayfası canlı, içerik doğru
- [ ] Veli signup'ta KVKK consent zorunlu
- [ ] "Çocuğu sil" çalışıyor, tüm verileri cascade siliyor
- [ ] Verilen hizmet için minimum veri ilkesi karşılanıyor

### Production Sağlık
- [ ] Sentry production'da aktif, son 7 günde kritik hata yok
- [ ] Railway PG günlük backup çalışıyor
- [ ] Tüm env vars production'da set
- [ ] SSL aktif
- [ ] Custom domain (varsa) DNS doğru

### Beta Feedback
- [ ] En az 5 beta kullanıcısı 1+ modül tamamladı
- [ ] Veli memnuniyet ortalaması ≥ 7/10
- [ ] Bug listesi prioritize edildi
- [ ] Acil bug fix turu bitti

**Tümü ✅ ise: V1 LANSMAN HAZIR! 🚀**

---

## V1 Sonrası

Plan'lar bitince spec'in 13. bölümündeki V1.5 ve V2 yol haritalarına bak:

- **V1.5 (1-2 ay sonra):** Push notification, AI satranç koçu, açılış teorisi
- **V2 (4-6 ay sonra):** Çoklu dil, native iOS/Android, turnuvalar, çocuklar arası follow

Her birinin kendi spec + plan ihtiyacı var. V1 stabil ürün ortaya çıkınca ihtiyaca göre yeni brainstorming + writing-plans turuna başla.
