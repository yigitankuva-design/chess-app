import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PracticeResult } from '@/components/practice/PracticeResult';

describe('PracticeResult', () => {
  it('doğru sayısını ve puanı gösterir', () => {
    render(<PracticeResult correct={17} total={20} score={85} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.getByText(/17 \/ 20/)).toBeInTheDocument();
    expect(screen.getByText(/85 \/ 100/)).toBeInTheDocument();
  });

  it('düşük puanda daha fazla pratik mesajı', () => {
    render(<PracticeResult correct={4} total={20} score={20} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.getByText('Çok Daha Fazla Pratik Yapmalısın')).toBeInTheDocument();
  });

  it('orta puanda iyi gidiyorsun mesajı', () => {
    render(<PracticeResult correct={12} total={20} score={60} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.getByText('İyi Gidiyorsun')).toBeInTheDocument();
  });

  it('yüksek puanda tebrikler mesajı', () => {
    render(<PracticeResult correct={18} total={20} score={90} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.getByText('Tebrikler')).toBeInTheDocument();
  });

  it('kilit açıldıysa kutlama satırı gösterilir', () => {
    render(<PracticeResult correct={17} total={20} score={85} unlocked="Süreli Pratik" onRetry={vi.fn()} />);
    expect(screen.getByText(/Süreli Pratik açıldı/)).toBeInTheDocument();
  });

  it('kilit açılmadıysa kutlama satırı YOK', () => {
    render(<PracticeResult correct={16} total={20} score={80} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.queryByText(/açıldı/)).not.toBeInTheDocument();
  });

  it('Tekrar Dene butonu onRetry çağırır', () => {
    const onRetry = vi.fn();
    render(<PracticeResult correct={10} total={20} score={50} unlocked={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Tekrar Dene'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
