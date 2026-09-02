import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/components/play/OpeningPractice', () => ({
  OpeningPractice: ({ onReadyToStart, onOpenKonumPratigi, onOpenTeoriPratigi }: {
    onReadyToStart?: (variant: { id: number }, criteria: {
      level: { level: number }; timeControl: { label: string }; colorChoice: string;
    }) => void;
    onOpenKonumPratigi?: () => void;
    onOpenTeoriPratigi?: () => void;
  }) => (
    <div data-testid="opening-practice">
      açılış pratiği içeriği
      {onReadyToStart && (
        <button onClick={() => onReadyToStart(
          { id: 7 },
          { level: { level: 5 }, timeControl: { label: '5+0' }, colorChoice: 'white' },
        )}>
          test-ready-to-start
        </button>
      )}
      {onOpenKonumPratigi && <button onClick={onOpenKonumPratigi}>test-open-konum</button>}
      {onOpenTeoriPratigi && <button onClick={onOpenTeoriPratigi}>test-open-teori</button>}
    </div>
  ),
}));

import { CustomTabPanel } from '@/components/custom/CustomTabPanel';
import type { CustomTabDetail } from '@/lib/customTabsApi';

/** Madde 2026-09-02: "Açılış Pratiği Yap" artık gerçek bir kayıt (diğer 2
 *  sabit alt sekmeyle AYNI order_index mantığı) — HARDCODED değil, fixture'a
 *  eklenmesi gerekiyor. order_index 0 = testlerde varsayılan olarak en önde. */
const ACILIS_SECTION = {
  id: 9, order_index: 0, title: 'Açılış Pratiği Yap', section_kind: 'opening', body: '', images: [], practice_positions: [],
  konum_pratigi_pool: [{
    id: 'q1', instruction: 'x',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    answer_kind: 'sentence' as const, options: ['A', 'B'], correct_index: 0,
  }],
  teori_pratigi_pool: [],
};

const PRATIK: CustomTabDetail = {
  id: 1, label: 'Pratik Yap', emoji: '🎯',
  sections: [
    ACILIS_SECTION,
    {
      id: 10, order_index: 1, title: 'Süresiz Pratik', body: 'gizli metin', images: [],
      practice_positions: [{ id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }],
    },
  ],
};

const BULMACA: CustomTabDetail = {
  id: 2, label: 'Bulmacalar', emoji: '🧩',
  sections: [{ id: 20, order_index: 1, title: 'Bölüm', body: 'normal metin', images: [], practice_positions: [] }],
};

describe('CustomTabPanel', () => {
  it('Açılış Pratiği Yap SAYFA DEĞİŞTİRMEZ, tıklanınca aynı sayfada açılır (madde: 2026-08-18)', () => {
    render(<CustomTabPanel tab={PRATIK} />);
    // Eskiden bir <a href="/play?mode=opening"> idi — artık link YOKTUR.
    expect(screen.getByText('Açılış Pratiği Yap').closest('a')).toBeNull();
    expect(screen.queryByTestId('opening-practice')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    expect(screen.getByTestId('opening-practice')).toBeInTheDocument();
    // Tekrar tıklayınca kapanır.
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    expect(screen.queryByTestId('opening-practice')).not.toBeInTheDocument();
  });

  it('Açılış Pratiği seçimi bitince ASIL MAÇ /play sayfasına yönlendirilir, burada açılmaz (madde: 2026-08-19)', () => {
    push.mockClear();
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    fireEvent.click(screen.getByText('test-ready-to-start'));
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('mode=opening');
    expect(url).toContain('variant=7');
    expect(url).toContain('skill=5');
    expect(url).toContain('tc=5%2B0');
    expect(url).toContain('color=white');
  });

  it('madde 2026-09-02 (devam): a) Konum Pratiği açılınca /play?mode=konum-pratigi\'ye yönlendirilir', () => {
    push.mockClear();
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    fireEvent.click(screen.getByText('test-open-konum'));
    expect(push).toHaveBeenCalledWith('/play?mode=konum-pratigi&tab=1&section=9');
  });

  it('madde 2026-09-02 (devam): b) Teori Pratiği açılınca /play?mode=teori-pratigi\'ye yönlendirilir', () => {
    push.mockClear();
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    fireEvent.click(screen.getByText('test-open-teori'));
    expect(push).toHaveBeenCalledWith('/play?mode=teori-pratigi&tab=1&section=9');
  });

  it('Açılış Pratiği Yap açıkken bir alt sekme açılırsa Açılış Pratiği kapanır (tek akordiyon)', () => {
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    expect(screen.getByTestId('opening-practice')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    expect(screen.queryByTestId('opening-practice')).not.toBeInTheDocument();
    expect(screen.getByText(/Pratiğe Başla/)).toBeInTheDocument();
  });

  it('bir alt sekme açıkken Açılış Pratiği Yap açılırsa alt sekme kapanır (tek akordiyon)', () => {
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    expect(screen.getByText(/Pratiğe Başla/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    expect(screen.getByTestId('opening-practice')).toBeInTheDocument();
    expect(screen.queryByText(/Pratiğe Başla/)).not.toBeInTheDocument();
  });

  it('Pratik Yap OLMAYAN sekmede Açılış Pratiği Yap YOKTUR', () => {
    render(<CustomTabPanel tab={BULMACA} />);
    expect(screen.queryByText('Açılış Pratiği Yap')).not.toBeInTheDocument();
  });

  it('iç içe alt sekme sporcu tarafında da açılıp kapanır (madde: 2026-08-22, Antrenör/Sınıflar ihtiyacı)', () => {
    const tab: CustomTabDetail = {
      id: 3, label: 'Antrenör', emoji: '🎓',
      sections: [
        { id: 100, order_index: 1, title: 'Sınıflar', body: '', images: [], practice_positions: [], parent_id: null },
        { id: 101, order_index: 1, title: '9-A Sınıfı', body: 'Öğrenci listesi burada', images: [], practice_positions: [], parent_id: 100 },
      ],
    };
    render(<CustomTabPanel tab={tab} />);
    expect(screen.queryByText('9-A Sınıfı')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Sınıflar'));
    expect(screen.getByText('9-A Sınıfı')).toBeInTheDocument();
    expect(screen.queryByText('Öğrenci listesi burada')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('9-A Sınıfı'));
    expect(screen.getByText('Öğrenci listesi burada')).toBeInTheDocument();
  });

  it('alt sekme kapalıyken içerik görünmez, tıklayınca açılır', () => {
    render(<CustomTabPanel tab={BULMACA} />);
    expect(screen.queryByText('normal metin')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Bölüm'));
    expect(screen.getByText('normal metin')).toBeInTheDocument();
  });

  it('Pratik Yap alt sekmesinde yazı yerine kriter ekranı gelir', () => {
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    expect(screen.getByText(/Pratiğe Başla/)).toBeInTheDocument();
    expect(screen.queryByText('gizli metin')).not.toBeInTheDocument();
  });

  it('Pratiğe Başla maç sayfasına doğru adresle gider', async () => {
    push.mockClear();
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    fireEvent.click(screen.getByRole('button', { name: 'Orta' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    // Madde 5 (2026-08-19): Renk seçimi Pratik Yap'ta kaldırıldı — varsayılan 'random' gider.
    expect(screen.queryByRole('button', { name: 'Beyaz' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('mode=pool');
    expect(url).toContain('tab=1');
    expect(url).toContain('section=10');
    expect(url).toContain('skill=5');
    expect(url).toContain('color=random');
  });

  it('kriter ekranında 10 düzey yerine Kolay/Orta/Zor gösterir (madde: Pratik Yap basitleştirilmiş düzey)', () => {
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    expect(screen.getByRole('button', { name: 'Kolay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Orta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zor' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Düzey 1' })).not.toBeInTheDocument();
  });

  it('havuzu boş olan Pratik Yap alt sekmesinde bilgi mesajı görünür', () => {
    const bos: CustomTabDetail = {
      id: 1, label: 'Pratik Yap', emoji: '🎯',
      sections: [ACILIS_SECTION, { id: 11, order_index: 1, title: 'Boş Pratik', body: '', images: [], practice_positions: [] }],
    };
    render(<CustomTabPanel tab={bos} />);
    fireEvent.click(screen.getByText('Boş Pratik'));
    expect(screen.getByText(/Henüz konum eklenmedi/)).toBeInTheDocument();
    expect(screen.queryByText(/Pratiğe Başla/)).not.toBeInTheDocument();
  });

  it('Oyunsonu Pratiği Yap açılınca kriter değil, 5 kategori seçeneği görünür', () => {
    const tab: CustomTabDetail = {
      id: 1, label: 'Pratik Yap', emoji: '🎯',
      sections: [{
        id: 40, order_index: 1, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [],
        practice_positions: [
          { id: 'a', fen: 'x', category: 'Piyon Finalleri' },
          { id: 'b', fen: 'y', category: 'Kale Finalleri' },
          { id: 'c', fen: 'z', category: 'Kale Finalleri' },
        ],
      }],
    };
    render(<CustomTabPanel tab={tab} />);
    fireEvent.click(screen.getByText('Oyunsonu Pratiği Yap'));
    expect(screen.getByText('Piyon Finalleri')).toBeInTheDocument();
    expect(screen.getByText('Kale Finalleri')).toBeInTheDocument();
    expect(screen.getByText('Hafif Taşlar Arası Mücadele')).toBeInTheDocument();
    expect(screen.getByText('Ağır Taşlar Arası Mücadele')).toBeInTheDocument();
    expect(screen.getByText('Ağır Taşlar ile Hafif Taşlar Arası Mücadele')).toBeInTheDocument();
    expect(screen.queryByText(/Pratiğe Başla/)).not.toBeInTheDocument();
    // Kategorisiz konum bu listede yok, bu yüzden kategori sayıları toplamı 3'ü geçmez.
    expect(screen.queryByText('Kategorisiz')).not.toBeInTheDocument();
  });

  it('Oyunsonu kategorisine tıklayınca o kategorinin kriter ekranı gelir ve adrese kategori yazılır', async () => {
    push.mockClear();
    const tab: CustomTabDetail = {
      id: 5, label: 'Pratik Yap', emoji: '🎯',
      sections: [{
        id: 41, order_index: 1, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [],
        practice_positions: [
          { id: 'a', fen: 'x', category: 'Piyon Finalleri' },
          { id: 'b', fen: 'y', category: 'Kale Finalleri' },
        ],
      }],
    };
    render(<CustomTabPanel tab={tab} />);
    fireEvent.click(screen.getByText('Oyunsonu Pratiği Yap'));
    fireEvent.click(screen.getByText('Piyon Finalleri'));
    expect(screen.getByText(/Pratiğe Başla/)).toBeInTheDocument();
    // Diğer kategorinin adı artık ekranda yok — kriter ekranına geçildi.
    expect(screen.queryByText('Kale Finalleri')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Kolay' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Düzey 1' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Orta' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    expect(screen.queryByRole('button', { name: 'Beyaz' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('mode=pool');
    expect(url).toContain('section=41');
    expect(url).toContain('category=Piyon');
    expect(url).toContain('skill=5');
    expect(url).toContain('color=random');
  });

  it('konumu olmayan bir Oyunsonu kategorisine tıklayınca bilgi mesajı görünür', () => {
    const tab: CustomTabDetail = {
      id: 6, label: 'Pratik Yap', emoji: '🎯',
      sections: [{
        id: 42, order_index: 1, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [],
        practice_positions: [{ id: 'a', fen: 'x', category: 'Piyon Finalleri' }],
      }],
    };
    render(<CustomTabPanel tab={tab} />);
    fireEvent.click(screen.getByText('Oyunsonu Pratiği Yap'));
    fireEvent.click(screen.getByText('Kale Finalleri'));
    expect(screen.getByText(/Bu kategoride henüz konum yok/)).toBeInTheDocument();
  });

  it('Pratik Yap sekmesinde sabit alt sekmeler (Açılış/Kazanç/Oyunsonu) İKONLU gelir ve hocanın sekmesinden ÖNCE gelir', () => {
    const tab: CustomTabDetail = {
      id: 1, label: 'Pratik Yap', emoji: '🎯',
      sections: [
        { id: 30, order_index: 4, title: 'Hocanın Sekmesi', body: 'x', images: [], practice_positions: [] },
        { id: 31, order_index: 2, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [], practice_positions: [] },
        { id: 32, order_index: 3, title: 'Kazanç Konumunu Pratik Yap', section_kind: 'kazanc', body: '', images: [], practice_positions: [] },
        ACILIS_SECTION,
      ],
    };
    render(<CustomTabPanel tab={tab} />);
    const sira = screen.getAllByRole('button')
      .map((b) => b.textContent || '')
      .filter((t) => /Kazanç|Oyunsonu|Hocanın|Açılış/.test(t));
    // Madde 2026-09-02: sabitlerin KENDİ ARALARINDAKİ sırası artık gerçek
    // order_index'e göre (0 < 2 < 3) — Açılış, Oyunsonu, Kazanç. Hocanın
    // sekmesi (sabit değil) her zaman EN SONA düşer.
    expect(sira[0]).toContain('Açılış Pratiği Yap');
    expect(sira[1]).toContain('Oyunsonu Pratiği Yap');
    expect(sira[2]).toContain('Kazanç Konumunu Pratik Yap');
    expect(sira[3]).toContain('Hocanın Sekmesi');
    expect(sira[0]).toContain('📖');
    expect(sira[1]).toContain('🏁');
    expect(sira[2]).toContain('🏆');
  });

  it('Alt Konu\'ya tıklanınca AYRI sayfaya yönlendirilir, akordiyon içinde açılmaz (madde: 2026-08-25)', () => {
    push.mockClear();
    const tab: CustomTabDetail = {
      id: 5, label: 'Antrenör', emoji: '🎓',
      sections: [
        { id: 200, order_index: 1, title: 'Dersler', body: '', images: [], practice_positions: [], parent_id: null },
        { id: 201, order_index: 1, title: 'Temel Düzey', body: '', images: [], practice_positions: [], parent_id: 200 },
        { id: 202, order_index: 1, title: 'Tahta ve Taşlar', body: '', images: [], practice_positions: [], parent_id: 201 },
        {
          id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', body: '', images: [], parent_id: 202,
          practice_positions: [
            { id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
            { id: 'p2', fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1' },
          ],
        },
      ],
    };
    render(<CustomTabPanel tab={tab} />);
    fireEvent.click(screen.getByText('Dersler'));
    fireEvent.click(screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('Tahta ve Taşlar'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));

    expect(push).toHaveBeenCalledWith('/custom/5/alt-konu/203');
    // Akordiyon içinde İÇERİK açılmaz — ayrı sayfaya gidiyor.
    expect(screen.queryByLabelText(/Konum 001/)).not.toBeInTheDocument();
  });

  it('Konu (Tahta ve Taşlar) seviyesinde hâlâ NORMAL iç içe akordiyon davranışı sürer (konum havuzu YOK)', () => {
    const tab: CustomTabDetail = {
      id: 5, label: 'Antrenör', emoji: '🎓',
      sections: [
        { id: 200, order_index: 1, title: 'Dersler', body: '', images: [], practice_positions: [], parent_id: null },
        { id: 201, order_index: 1, title: 'Temel Düzey', body: '', images: [], practice_positions: [], parent_id: 200 },
        { id: 202, order_index: 1, title: 'Tahta ve Taşlar', body: 'konu yazısı', images: [], practice_positions: [], parent_id: 201 },
      ],
    };
    render(<CustomTabPanel tab={tab} />);
    fireEvent.click(screen.getByText('Dersler'));
    fireEvent.click(screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('Tahta ve Taşlar'));
    expect(screen.getByText('konu yazısı')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Konum 001/)).not.toBeInTheDocument();
  });
});
