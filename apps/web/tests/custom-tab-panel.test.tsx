import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/components/play/OpeningPractice', () => ({
  OpeningPractice: ({ onReadyToStart }: {
    onReadyToStart?: (variant: { id: number }, criteria: {
      level: { level: number }; timeControl: { label: string }; colorChoice: string;
    }) => void;
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
    </div>
  ),
}));

import { CustomTabPanel } from '@/components/custom/CustomTabPanel';
import type { CustomTabDetail } from '@/lib/customTabsApi';

const PRATIK: CustomTabDetail = {
  id: 1, label: 'Pratik Yap', emoji: '🎯',
  sections: [{
    id: 10, order_index: 1, title: 'Süresiz Pratik', body: 'gizli metin', images: [],
    practice_positions: [{ id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }],
  }],
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
      sections: [{ id: 11, order_index: 1, title: 'Boş Pratik', body: '', images: [], practice_positions: [] }],
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
        id: 40, order_index: 1, title: 'Oyunsonu Pratiği Yap', body: '', images: [],
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
        id: 41, order_index: 1, title: 'Oyunsonu Pratiği Yap', body: '', images: [],
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
        id: 42, order_index: 1, title: 'Oyunsonu Pratiği Yap', body: '', images: [],
        practice_positions: [{ id: 'a', fen: 'x', category: 'Piyon Finalleri' }],
      }],
    };
    render(<CustomTabPanel tab={tab} />);
    fireEvent.click(screen.getByText('Oyunsonu Pratiği Yap'));
    fireEvent.click(screen.getByText('Kale Finalleri'));
    expect(screen.getByText(/Bu kategoride henüz konum yok/)).toBeInTheDocument();
  });

  it('Pratik Yap sekmesinde sabit alt sekmeler ikonlu ve önce gelir', () => {
    const tab: CustomTabDetail = {
      id: 1, label: 'Pratik Yap', emoji: '🎯',
      sections: [
        { id: 30, order_index: 1, title: 'Hocanın Sekmesi', body: 'x', images: [], practice_positions: [] },
        { id: 31, order_index: 2, title: 'Oyunsonu Pratiği Yap', body: '', images: [], practice_positions: [] },
        { id: 32, order_index: 3, title: 'Kazanç Konumunu Pratik Yap', body: '', images: [], practice_positions: [] },
      ],
    };
    render(<CustomTabPanel tab={tab} />);
    const sira = screen.getAllByRole('button')
      .map((b) => b.textContent || '')
      .filter((t) => /Kazanç|Oyunsonu|Hocanın/.test(t));
    expect(sira[0]).toContain('Kazanç Konumunu Pratik Yap');
    expect(sira[1]).toContain('Oyunsonu Pratiği Yap');
    expect(sira[2]).toContain('Hocanın Sekmesi');
    expect(sira[0]).toContain('🏆');
    expect(sira[1]).toContain('🏁');
  });
});
