import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalizPageHeader } from '@/components/analiz/AnalizPageHeader';

describe('AnalizPageHeader (madde 2026-09-04 (1a/1b, 3a/3b, 4a/4b))', () => {
  it('başlığı gösterir', () => {
    render(<AnalizPageHeader title="Yeni Analiz" onBack={vi.fn()} />);
    expect(screen.getByText('Yeni Analiz')).toBeInTheDocument();
  });

  it('Geri butonuna tıklanınca onBack çağrılır', () => {
    const onBack = vi.fn();
    render(<AnalizPageHeader title="Yeni Analiz" onBack={onBack} />);
    fireEvent.click(screen.getByLabelText('Geri'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Geri butonunda artık metin ok ("←") YOK — SVG ikon kullanılır', () => {
    render(<AnalizPageHeader title="Yeni Analiz" onBack={vi.fn()} />);
    const backBtn = screen.getByLabelText('Geri');
    expect(backBtn.textContent).toBe('');
    expect(backBtn.querySelector('svg')).not.toBeNull();
  });

  it('Geri butonu eval bar ile hizalanmak için sola kaydırılmış ve çerçevesi belirgin', () => {
    render(<AnalizPageHeader title="Yeni Analiz" onBack={vi.fn()} />);
    expect(screen.getByLabelText('Geri')).toHaveStyle({
      marginLeft: '-7px',
      border: '2px solid rgba(34,211,238,0.6)',
    });
  });

  it('başlık, tahta genişliğine (380px) eşit bir kutu içinde ortalanır', () => {
    const { container } = render(<AnalizPageHeader title="Konum Analizi" onBack={vi.fn()} />);
    const titleWrapper = screen.getByText('Konum Analizi').parentElement;
    expect(titleWrapper?.className).toContain('justify-center');
    expect(titleWrapper).toHaveStyle({ maxWidth: '380px' });
    expect(container).toBeTruthy();
  });
});
