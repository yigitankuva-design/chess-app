import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PracticeResult } from '@/components/practice/PracticeResult';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const retryHeadline = { text: 'Üzgünüm Yeniden Ödevini Yapmalısın', tone: 'retry' as const };
const successHeadline = { text: 'Tebrikler Süreli Pratik Yapabilirsin', tone: 'success' as const };

describe('PracticeResult — madde 7', () => {
  it('doğru sayısını ve puanı gösterir', () => {
    render(<PracticeResult correct={17} total={20} score={85} unlocked={null}
      onRetry={vi.fn()} boardFen={FEN} headline={successHeadline} />);
    expect(screen.getByText(/17 \/ 20/)).toBeInTheDocument();
    expect(screen.getByText(/85 \/ 100/)).toBeInTheDocument();
  });

  it('85 altında büyük başlık KIRMIZI tonda gösterilir', () => {
    render(<PracticeResult correct={4} total={20} score={20} unlocked={null}
      onRetry={vi.fn()} boardFen={FEN} headline={retryHeadline} />);
    const baslik = screen.getByText('Üzgünüm Yeniden Ödevini Yapmalısın');
    expect(baslik).toBeInTheDocument();
    expect((baslik as HTMLElement).style.color).toBe('#dc2626');
  });

  it('85 ve üzerinde büyük başlık YEŞİL tonda gösterilir', () => {
    render(<PracticeResult correct={18} total={20} score={90} unlocked={null}
      onRetry={vi.fn()} boardFen={FEN} headline={successHeadline} />);
    const baslik = screen.getByText('Tebrikler Süreli Pratik Yapabilirsin');
    expect((baslik as HTMLElement).style.color).toBe('#16a34a');
  });

  it('tahta MATLAŞTIRILMIŞ olarak (grayscale+brightness filtresiyle) çizilir', () => {
    const { container } = render(
      <PracticeResult correct={17} total={20} score={85} unlocked={null}
        onRetry={vi.fn()} boardFen={FEN} headline={successHeadline} />,
    );
    const matBolge = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(matBolge.style.filter).toContain('grayscale');
    expect(matBolge.style.filter).toContain('brightness');
  });

  it('kilit açıldıysa kutlama satırı gösterilir', () => {
    render(<PracticeResult correct={17} total={20} score={85} unlocked="Süreli Pratik"
      onRetry={vi.fn()} boardFen={FEN} headline={successHeadline} />);
    expect(screen.getByText(/Süreli Pratik açıldı/)).toBeInTheDocument();
  });

  it('kilit açılmadıysa kutlama satırı YOK', () => {
    render(<PracticeResult correct={16} total={20} score={80} unlocked={null}
      onRetry={vi.fn()} boardFen={FEN} headline={retryHeadline} />);
    expect(screen.queryByText(/açıldı/)).not.toBeInTheDocument();
  });

  it('Tekrar Dene butonu onRetry çağırır', () => {
    const onRetry = vi.fn();
    render(<PracticeResult correct={10} total={20} score={50} unlocked={null}
      onRetry={onRetry} boardFen={FEN} headline={retryHeadline} />);
    fireEvent.click(screen.getByText('Tekrar Dene'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('boardFen boşsa (hiç tahta sorusu yoksa) standart konuma düşer, çökmez', () => {
    render(<PracticeResult correct={10} total={20} score={50} unlocked={null}
      onRetry={vi.fn()} boardFen="" headline={retryHeadline} />);
    expect(screen.getByText('Üzgünüm Yeniden Ödevini Yapmalısın')).toBeInTheDocument();
  });
});
