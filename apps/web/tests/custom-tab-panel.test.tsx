import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

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
  it('Pratik Yap sekmesinde sabit Açılış Pratiği Yap satırı vardır', () => {
    render(<CustomTabPanel tab={PRATIK} />);
    const link = screen.getByText('Açılış Pratiği Yap').closest('a');
    expect(link).toHaveAttribute('href', '/play?mode=opening');
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
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz' }));
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('mode=pool');
    expect(url).toContain('tab=1');
    expect(url).toContain('section=10');
    expect(url).toContain('skill=2');
    expect(url).toContain('color=white');
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
});
