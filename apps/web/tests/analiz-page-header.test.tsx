import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalizPageHeader } from '@/components/analiz/AnalizPageHeader';

describe('AnalizPageHeader (madde 2026-09-04 (4): kendi geri butonu kaldırıldı)', () => {
  it('başlığı gösterir', () => {
    render(<AnalizPageHeader title="Yeni Analiz" />);
    expect(screen.getByText('Yeni Analiz')).toBeInTheDocument();
  });

  it('artık kendi "Geri" butonunu ÇİZMEZ — uygulama genelinde TEK buton AppNav\'da', () => {
    render(<AnalizPageHeader title="Yeni Analiz" />);
    expect(screen.queryByLabelText('Geri')).not.toBeInTheDocument();
  });

  it('başlık, tahta genişliğine (380px) eşit bir kutu içinde ortalanır', () => {
    render(<AnalizPageHeader title="Konum Analizi" />);
    const titleWrapper = screen.getByText('Konum Analizi').parentElement;
    expect(titleWrapper?.className).toContain('justify-center');
    expect(titleWrapper).toHaveStyle({ maxWidth: '380px' });
  });
});
