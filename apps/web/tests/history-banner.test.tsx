import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryBanner } from '@/components/play/HistoryBanner';

describe('HistoryBanner — geçmiş uyarı şeridi (madde 1)', () => {
  it('canlıyken hiçbir şey göstermez', () => {
    const { container } = render(
      <HistoryBanner isLive viewIndex={3} onGoLive={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('geçmişteyken kaçıncı hamlenin incelendiğini söyler', () => {
    render(<HistoryBanner isLive={false} viewIndex={2} onGoLive={vi.fn()} />);
    expect(screen.getByText(/2\. hamle/)).toBeInTheDocument();
  });

  it('başlangıç konumunda özel metin gösterir', () => {
    render(<HistoryBanner isLive={false} viewIndex={0} onGoLive={vi.fn()} />);
    expect(screen.getByText(/Başlangıç konumu/)).toBeInTheDocument();
  });

  it('Canlıya dön butonu geri çağırıyı tetikler', () => {
    const onGoLive = vi.fn();
    render(<HistoryBanner isLive={false} viewIndex={2} onGoLive={onGoLive} />);
    fireEvent.click(screen.getByRole('button', { name: 'Canlıya dön' }));
    expect(onGoLive).toHaveBeenCalledTimes(1);
  });

  it('taşlar oynatılamayacağını AÇIKÇA söyler', () => {
    render(<HistoryBanner isLive={false} viewIndex={2} onGoLive={vi.fn()} />);
    expect(screen.getByText(/taş oynatamazsın/i)).toBeInTheDocument();
  });
});
