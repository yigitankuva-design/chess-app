import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleCard } from '@/components/admin/CollapsibleCard';

describe('CollapsibleCard', () => {
  it("KAPALI başlar — içerik DOM'da yoktur", () => {
    render(
      <CollapsibleCard title="Süresiz Pratik Yap Soru Havuzu"><p>GİZLİ İÇERİK</p></CollapsibleCard>,
    );
    expect(screen.getByText('Süresiz Pratik Yap Soru Havuzu')).toBeInTheDocument();
    expect(screen.queryByText('GİZLİ İÇERİK')).not.toBeInTheDocument();
  });

  it('başlığa tıklayınca açılır, tekrar tıklayınca kapanır', () => {
    render(
      <CollapsibleCard title="Havuz"><p>GİZLİ İÇERİK</p></CollapsibleCard>,
    );
    const btn = screen.getByRole('button', { name: /Havuz/ });
    fireEvent.click(btn);
    expect(screen.getByText('GİZLİ İÇERİK')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('GİZLİ İÇERİK')).not.toBeInTheDocument();
  });

  it('rozet yazısı başlıkta görünür', () => {
    render(
      <CollapsibleCard title="Havuz" badge="27 soru"><p>x</p></CollapsibleCard>,
    );
    expect(screen.getByText('27 soru')).toBeInTheDocument();
  });

  it('forceOpen=true ise AÇIK başlar ve tıklamayla kapanmaz', () => {
    render(
      <CollapsibleCard title="Havuz" forceOpen><p>GİZLİ İÇERİK</p></CollapsibleCard>,
    );
    expect(screen.getByText('GİZLİ İÇERİK')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Havuz/ }));
    // Bir soru düzenlenirken havuz kapanmamalı — hangi soruda olunduğu görünsün.
    expect(screen.getByText('GİZLİ İÇERİK')).toBeInTheDocument();
  });

  it('aria-expanded durumu doğru bildirir', () => {
    render(<CollapsibleCard title="Havuz"><p>x</p></CollapsibleCard>);
    const btn = screen.getByRole('button', { name: /Havuz/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });
});
