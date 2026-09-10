import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PositionPoolEntry } from '@/lib/customTabsApi';

// NEDEN STUB: gerçek react-chessboard, taş animasyonu için kareden
// getBoundingClientRect().width okur; happy-dom'da layout olmadığı için FEN
// değişince (adım/grup geçişinde) "Square width not found" fırlatır. Bu
// testlerde incelenen şey tahta çizimi DEĞİL, hangi konum/cümlenin aktif
// olduğu — bkz. tests/board-exercise-question-reset.test.tsx'teki AYNI desen.
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, hideNotation }: { fen: string; hideNotation?: boolean }) => (
    <div>
      <div data-square="e4" data-fen={fen} />
      {!hideNotation && <span>a</span>}
    </div>
  ),
}));

// Madde 2026-09-07 (GRUP D): "Ödev Gönder" ikonu role'e göre koşullu —
// mockRole test başına değiştirilebilir.
let mockRole: 'teacher' | 'athlete' | null = null;
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), token: 'tok', role: mockRole, userId: 1 }),
}));

import { AltKonuWalkthrough } from '@/components/custom/AltKonuWalkthrough';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN2 = '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1';

function group(id: string, code: string, steps: PositionPoolEntry['steps']): PositionPoolEntry {
  return { id, code, steps };
}

beforeEach(() => { mockRole = null; });

describe('AltKonuWalkthrough — adım gezinme (madde 2026-08-26, madde 2026-09-09 devam)', () => {
  it('havuz boşken bilgi mesajı gösterir', () => {
    render(<AltKonuWalkthrough pool={[]} />);
    expect(screen.getByText('Henüz konum eklenmedi.')).toBeInTheDocument();
  });

  it('ilk grup (kod 001) ile açılır, sayaç ve tahta doğru gösterilir', () => {
    const pool = [
      group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'Birinci adım.', turn: 'w' }]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('1 / 1 — Konum Havuzu 001')).toBeInTheDocument();
    expect(screen.getByText('Birinci adım.')).toBeInTheDocument();
    // Tek adım var — hem önceki hem sonraki devre dışı.
    expect(screen.getByLabelText('Önceki adım')).toBeDisabled();
    expect(screen.getByLabelText('Sonraki adım')).toBeDisabled();
  });

  it('madde 2026-09-09 (devam): İleri/Geri okları numaralı butonlarla (Adım N) AYNI stepIdx\'i değiştirir — Zafer\'in "1 nolu butondan 2 nolu butona" isteği', () => {
    const pool = [
      group('g1', '001', [
        { id: 's1', fen: FEN, sentence: 'Adım 1 cümlesi', turn: 'w' },
        { id: 's2', fen: FEN2, sentence: 'Adım 2 cümlesi', turn: 'b' },
      ]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('Adım 1 cümlesi')).toBeInTheDocument();
    expect(screen.getByLabelText('Önceki adım')).toBeDisabled();
    expect(screen.getByLabelText('Sonraki adım')).not.toBeDisabled();

    // İleri ok: 1 nolu butondan 2 nolu butona.
    fireEvent.click(screen.getByLabelText('Sonraki adım'));
    expect(screen.getByText('Adım 2 cümlesi')).toBeInTheDocument();
    expect(screen.queryByText('Adım 1 cümlesi')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Adım 2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Sonraki adım')).toBeDisabled();
    expect(screen.getByLabelText('Önceki adım')).not.toBeDisabled();

    // Geri ok: 2 nolu butondan 1 nolu butona.
    fireEvent.click(screen.getByLabelText('Önceki adım'));
    expect(screen.getByText('Adım 1 cümlesi')).toBeInTheDocument();
    expect(screen.getByLabelText('Adım 1')).toHaveAttribute('aria-pressed', 'true');

    // Grup sayacı ("1 / 1 — Konum Havuzu 001") adım geçişinden ETKİLENMEZ.
    expect(screen.getByText('1 / 1 — Konum Havuzu 001')).toBeInTheDocument();
  });

  it('bir grubun İÇİNDEKİ adımlar numaralı butonlarla gezilir, grup sayacı DEĞİŞMEZ', () => {
    const pool = [
      group('g1', '001', [
        { id: 's1', fen: FEN, sentence: 'Adım 1 cümlesi', turn: 'w' },
        { id: 's2', fen: FEN2, sentence: 'Adım 2 cümlesi', turn: 'b' },
      ]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('Adım 1 cümlesi')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Adım 2'));
    expect(screen.getByText('Adım 2 cümlesi')).toBeInTheDocument();
    expect(screen.queryByText('Adım 1 cümlesi')).not.toBeInTheDocument();
    // Butona tıklama ve ok ile gezinme AYNI stepIdx'i kontrol eder — buton
    // ile 2. adıma geçtikten sonra geri ok butonu artık aktif olmalı.
    expect(screen.getByLabelText('Önceki adım')).not.toBeDisabled();
    // Grup sayacı adım geçişinden ETKİLENMEZ.
    expect(screen.getByText('1 / 1 — Konum Havuzu 001')).toBeInTheDocument();
  });

  it('tek adımlı gruplarda numaralı buton sütunu gösterilmez', () => {
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.queryByLabelText('Adım 1')).not.toBeInTheDocument();
  });

  it('madde 6: notasyon alanı ve "Notasyon Verilerini Gizle" onay kutusu gösterilir, işaretlenince tahta koordinatları gizlenir', () => {
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('Notasyon alanı')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    const checkbox = screen.getByLabelText('Notasyon Verilerini Gizle');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
  });

  it('madde 2026-09-10 (2. görsel): tahta büyütülüp sayfayı kaplar (640px kap)', () => {
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} />);
    const board = document.querySelector('[data-square="e4"]');
    expect(board).toBeInTheDocument();
    const capsule = document.querySelector('div[style*="max-width: 640px"]');
    expect(capsule).toBeInTheDocument();
  });

  it('madde 2026-09-10: cümle ve notasyon kartları artık tam genişlikte (472px max-width sınırı KALDIRILDI)', () => {
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'Cümle burada.', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} />);
    const sentenceCard = screen.getByText('Cümle burada.').closest('div');
    expect(sentenceCard).toHaveClass('t-card-i', 'w-full');
    expect(sentenceCard?.getAttribute('style') ?? '').not.toContain('max-width');
    const notationCard = screen.getByText('Notasyon alanı').closest('div.t-card-i');
    expect(notationCard?.getAttribute('style') ?? '').not.toContain('max-width');
  });

  it('madde 2026-09-09 (devam): İleri/Geri artık büyük, dolgun mavi zemin + kalın siyah çerçeve — eski ince/soluk tasarım DEĞİL', () => {
    const pool = [
      group('g1', '001', [
        { id: 's1', fen: FEN, sentence: 'x', turn: 'w' },
        { id: 's2', fen: FEN2, sentence: 'y', turn: 'w' },
      ]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);

    const prevBtn = screen.getByLabelText('Önceki adım');
    expect(prevBtn).toHaveStyle({ width: '80px', height: '56px', background: '#3b82f6', border: '3px solid #0a0a0a' });
    const nextBtn = screen.getByLabelText('Sonraki adım');
    expect(nextBtn).toHaveStyle({ width: '80px', height: '56px', background: '#3b82f6', border: '3px solid #0a0a0a' });

    const counter = screen.getByText('1 / 1 — Konum Havuzu 001');
    expect(counter).toHaveStyle({ fontWeight: '600' });
    // Sayaç, tahtanın 640px'lik kabıyla AYNI kapsayıcı içinde (sol kenar hizası).
    const boardCapsule = document.querySelector('div[style*="max-width: 640px"]');
    expect(boardCapsule?.contains(counter)).toBe(true);
  });

  it('madde 2026-09-10 (2. görsel): numaralı adım daireleri tahtanın ÜSTÜNDE yatay bir sırada (DOM\'da tahtadan ÖNCE)', () => {
    const pool = [
      group('g1', '001', [
        { id: 's1', fen: FEN, sentence: 'Adım 1', turn: 'w' },
        { id: 's2', fen: FEN2, sentence: 'Adım 2', turn: 'w' },
      ]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    const kart1 = screen.getByLabelText('Adım 1');
    const board = document.querySelector('[data-square="e4"]')!;
    // Daire sırası, tahta kabından ÖNCE geliyor (üstünde).
    expect(kart1.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Sıra yatay (flex-wrap), eski dikey flex-col DEĞİL.
    expect(kart1.parentElement?.className).toContain('flex-wrap');
    expect(kart1.parentElement?.className).not.toContain('flex-col');
    // Daire boyutu 52px'e büyütüldü.
    expect(kart1).toHaveStyle({ width: '52px', height: '52px' });
  });

  it('madde 2026-09-07: seçili adım dairesi artık yeşil zemin + kalın siyah rakam (eski cyan telefonda net görünmüyordu)', () => {
    const pool = [
      group('g1', '001', [
        { id: 's1', fen: FEN, sentence: 'Adım 1', turn: 'w' },
        { id: 's2', fen: FEN2, sentence: 'Adım 2', turn: 'w' },
      ]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    const active = screen.getByLabelText('Adım 1');
    expect(active).toHaveStyle({ background: '#22c55e', color: '#0a0a0a', fontWeight: '800' });
    const inactive = screen.getByLabelText('Adım 2');
    expect(inactive).not.toHaveStyle({ background: '#22c55e' });
  });

  it('madde 2026-09-10 (2. görsel): adım dairelerinin çerçevesi kalın SİYAH (2px soluk beyaz → 3px #0a0a0a), seçilide yeşil', () => {
    const pool = [
      group('g1', '001', [
        { id: 's1', fen: FEN, sentence: 'Adım 1', turn: 'w' },
        { id: 's2', fen: FEN2, sentence: 'Adım 2', turn: 'w' },
      ]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByLabelText('Adım 1')).toHaveStyle({ border: '3px solid #16a34a' });
    expect(screen.getByLabelText('Adım 2')).toHaveStyle({ border: '3px solid #0a0a0a' });
  });
});

describe('AltKonuWalkthrough — gruplar arası geçiş oku (madde 2026-09-09, devam 3)', () => {
  it('madde 2026-09-10 (devam): TEK grup varken bile sağ oklar GÖRÜNÜR ama İKİSİ DE devre dışı (Zafer: "ödev gönder kartının sağına da ok koy")', () => {
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByLabelText('Önceki grup')).toBeInTheDocument();
    expect(screen.getByLabelText('Sonraki grup')).toBeInTheDocument();
    expect(screen.getByLabelText('Önceki grup')).toBeDisabled();
    expect(screen.getByLabelText('Sonraki grup')).toBeDisabled();
  });

  it('birden fazla grup varken gruplar arası ok görünür, tıklanınca gruba geçer ve adım 1\'e döner', () => {
    const pool = [
      group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'Grup 1 - Adım 1', turn: 'w' }]),
      group('g2', '002', [
        { id: 's2', fen: FEN2, sentence: 'Grup 2 - Adım 1', turn: 'w' },
        { id: 's3', fen: FEN, sentence: 'Grup 2 - Adım 2', turn: 'w' },
      ]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();
    expect(screen.getByLabelText('Önceki grup')).toBeDisabled();
    expect(screen.getByLabelText('Sonraki grup')).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText('Sonraki grup'));
    expect(screen.getByText('2 / 2 — Konum Havuzu 002')).toBeInTheDocument();
    expect(screen.getByText('Grup 2 - Adım 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Sonraki grup')).toBeDisabled();

    // 2. grup, kendi 1. adımıyla açılır — bir önceki grupta kalan adım
    // durumu sürmez (yeni grubun kendi adım listesi baştan gösterilir).
    fireEvent.click(screen.getByLabelText('Sonraki adım'));
    expect(screen.getByText('Grup 2 - Adım 2')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Önceki grup'));
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();
    expect(screen.getByText('Grup 1 - Adım 1')).toBeInTheDocument();
  });

  it('madde 2026-09-10: konum okları AYNI satırda ama Ödev Gönder\'in SAĞINDA (adım okları solda, Ödev Gönder ortada, konum okları sağda)', () => {
    mockRole = 'teacher';
    const pool = [
      group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }]),
      group('g2', '002', [{ id: 's2', fen: FEN2, sentence: 'y', turn: 'w' }]),
    ];
    render(<AltKonuWalkthrough pool={pool} sourceSectionId={7} sourceSectionTitle="Tahtanın Genel Özellikleri - 1" linkedLessonStepId={42} />);
    const nextStepBtn = screen.getByLabelText('Sonraki adım');
    const nextGroupBtn = screen.getByLabelText('Sonraki grup');
    const sendBtn = screen.getByLabelText('Ödev Gönder');
    const row = sendBtn.closest('.justify-between');
    expect(row).not.toBeNull();
    expect(row).toContainElement(nextStepBtn);
    expect(row).toContainElement(nextGroupBtn);
    // DOM sırası: adım oku → Ödev Gönder → konum oku.
    expect(nextStepBtn.compareDocumentPosition(sendBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sendBtn.compareDocumentPosition(nextGroupBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('madde 2026-09-10: konum okları adım oklarıyla AYNI boyutta ama TURUNCU zemin (görsel ayrışma)', () => {
    const pool = [
      group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }]),
      group('g2', '002', [{ id: 's2', fen: FEN2, sentence: 'y', turn: 'w' }]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    const prevGroup = screen.getByLabelText('Önceki grup');
    expect(prevGroup).toHaveStyle({ width: '80px', height: '56px', background: '#f97316', border: '3px solid #0a0a0a' });
    const nextGroup = screen.getByLabelText('Sonraki grup');
    expect(nextGroup).toHaveStyle({ width: '80px', height: '56px', background: '#f97316' });
  });

  it('madde 2026-09-09 (devam 3): "Ödev Gönder" butonu %40 büyütüldü (36px → 50px), madde 2026-09-10: zemin YEŞİL (görsel)', () => {
    mockRole = 'teacher';
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} sourceSectionId={7} sourceSectionTitle="Tahtanın Genel Özellikleri - 1" linkedLessonStepId={42} />);
    expect(screen.getByLabelText('Ödev Gönder')).toHaveStyle({ width: '50px', height: '50px', background: '#22c55e' });
  });
});

describe('AltKonuWalkthrough — "Ödev Gönder" ikonu (madde 2026-09-07, GRUP D)', () => {
  const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];

  it('antrenör (role=teacher) + sourceSectionId/Title + müfredat bağı verilince ikon görünür', () => {
    mockRole = 'teacher';
    render(<AltKonuWalkthrough pool={pool} sourceSectionId={7} sourceSectionTitle="Tahtanın Genel Özellikleri - 1" linkedLessonStepId={42} />);
    expect(screen.getByLabelText('Ödev Gönder')).toBeInTheDocument();
  });

  it('sporcu (role=athlete) görünümünde ikon GÖSTERİLMEZ', () => {
    mockRole = 'athlete';
    render(<AltKonuWalkthrough pool={pool} sourceSectionId={7} sourceSectionTitle="Tahtanın Genel Özellikleri - 1" linkedLessonStepId={42} />);
    expect(screen.queryByLabelText('Ödev Gönder')).not.toBeInTheDocument();
  });

  it('sourceSectionId/Title verilmezse antrenör olsa bile ikon GÖSTERİLMEZ', () => {
    mockRole = 'teacher';
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.queryByLabelText('Ödev Gönder')).not.toBeInTheDocument();
  });

  it('madde 2026-09-11 (Ödev Sistemi Faz 2): müfredat bağı YOKKEN "Ödev Gönder" DEVRE DIŞI ("bu alt konu müfredata bağlı değil")', () => {
    mockRole = 'teacher';
    render(<AltKonuWalkthrough pool={pool} sourceSectionId={7} sourceSectionTitle="Tahtanın Genel Özellikleri - 1" />);
    // Aktif (yeşil, tıklanabilir) buton YOK.
    expect(screen.queryByLabelText('Ödev Gönder')).not.toBeInTheDocument();
    // Devre dışı buton var — açıklayıcı etiket + disabled.
    const disabled = screen.getByLabelText('Ödev Gönder — bu alt konu müfredata bağlı değil');
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAttribute('title', expect.stringContaining('müfredata bağlı değil'));
  });

  it('madde 2026-09-11: müfredat bağı VARKEN "Ödev Gönder" aktif (yeşil, disabled değil)', () => {
    mockRole = 'teacher';
    render(<AltKonuWalkthrough pool={pool} sourceSectionId={7} sourceSectionTitle="Tahtanın Genel Özellikleri - 1" linkedLessonStepId={42} />);
    const btn = screen.getByLabelText('Ödev Gönder');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveStyle({ background: '#22c55e' });
    expect(screen.queryByLabelText('Ödev Gönder — bu alt konu müfredata bağlı değil')).not.toBeInTheDocument();
  });

  it('madde 2026-09-09 (görsel referans): İleri/Geri ve Ödev Gönder AYNI satırda — oklar solda, Ödev Gönder sağda', () => {
    mockRole = 'teacher';
    render(<AltKonuWalkthrough pool={pool} sourceSectionId={7} sourceSectionTitle="Tahtanın Genel Özellikleri - 1" linkedLessonStepId={42} />);
    const nextBtn = screen.getByLabelText('Sonraki adım');
    const sendBtn = screen.getByLabelText('Ödev Gönder');
    // Oklar ve Ödev Gönder (AssignHomeworkPanel kendi sarmalayıcısıyla) AYNI
    // satırın (flex justify-between) içinde — oklar sol-alt, Ödev Gönder
    // sağ-alt köşede hizalanır (tahtanın hemen altında).
    const row = sendBtn.closest('.justify-between');
    expect(row).not.toBeNull();
    expect(row).toContainElement(nextBtn);
  });
});

describe('AltKonuWalkthrough — sayaç başlığın yanına taşınabilir (madde 2026-09-09, onPoolLabelChange)', () => {
  const pool = [
    group('g1', '001', [
      { id: 's1', fen: FEN, sentence: 'Adım 1 cümlesi', turn: 'w' },
      { id: 's2', fen: FEN2, sentence: 'Adım 2 cümlesi', turn: 'w' },
    ]),
  ];

  it('onPoolLabelChange VERİLİRSE: sayaç KENDİ İÇİNDE artık gösterilmez, callback doğru metinle çağrılır', () => {
    const onPoolLabelChange = vi.fn();
    render(<AltKonuWalkthrough pool={pool} onPoolLabelChange={onPoolLabelChange} />);
    expect(screen.queryByText('1 / 1 — Konum Havuzu 001')).not.toBeInTheDocument();
    expect(onPoolLabelChange).toHaveBeenCalledWith('1 / 1 — Konum Havuzu 001');
  });

  it('madde 2026-09-09 (devam): ok ile adım değişse de callback\'e bildirilen grup sayacı DEĞİŞMEZ (sayaç grup, adım DEĞİL)', () => {
    const onPoolLabelChange = vi.fn();
    render(<AltKonuWalkthrough pool={pool} onPoolLabelChange={onPoolLabelChange} />);
    onPoolLabelChange.mockClear();
    fireEvent.click(screen.getByLabelText('Sonraki adım'));
    expect(screen.getByText('Adım 2 cümlesi')).toBeInTheDocument();
    expect(onPoolLabelChange).not.toHaveBeenCalled();
  });

  it('onPoolLabelChange VERİLMEZSE (eski/standalone kullanım): sayaç eskisi gibi KENDİ İÇİNDE gösterilir', () => {
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('1 / 1 — Konum Havuzu 001')).toBeInTheDocument();
  });
});
