import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepCard } from '@/components/play/StepCard';

describe('StepCard', () => {
  it("kapalıyken gövde DOM'a girmez", () => {
    render(
      <StepCard title="Açılış Konumunu Seç" open={false} onToggle={vi.fn()}>
        <p>gizli içerik</p>
      </StepCard>,
    );
    expect(screen.queryByText('gizli içerik')).not.toBeInTheDocument();
  });

  it('açıkken gövde görünür ve aria-expanded true olur', () => {
    render(
      <StepCard title="Açılış Konumunu Seç" open onToggle={vi.fn()}>
        <p>gizli içerik</p>
      </StepCard>,
    );
    expect(screen.getByText('gizli içerik')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Açılış Konumunu Seç/ }))
      .toHaveAttribute('aria-expanded', 'true');
  });

  it('adım numarası başlığın önüne yazılır', () => {
    render(
      <StepCard stepNumber={2} title="Maç Kriterlerini Seç" open={false} onToggle={vi.fn()}>
        <p>x</p>
      </StepCard>,
    );
    expect(screen.getByText('2. Maç Kriterlerini Seç')).toBeInTheDocument();
  });

  it('özet başlıkta gösterilir', () => {
    render(
      <StepCard title="Açılış Konumunu Seç" summary="✓ İtalyan Açılışı"
        open={false} onToggle={vi.fn()}>
        <p>x</p>
      </StepCard>,
    );
    expect(screen.getByText('✓ İtalyan Açılışı')).toBeInTheDocument();
  });

  it('tıklayınca onToggle çağrılır', () => {
    const onToggle = vi.fn();
    render(
      <StepCard title="Açılış Konumunu Seç" open={false} onToggle={onToggle}>
        <p>x</p>
      </StepCard>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Açılış Konumunu Seç/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('KİLİTLİ kart: aria-disabled taşır ve tıklama onToggle çağırmaz', () => {
    const onToggle = vi.fn();
    render(
      <StepCard title="Maç Kriterlerini Seç" open={false} locked onToggle={onToggle}>
        <p>x</p>
      </StepCard>,
    );
    const btn = screen.getByRole('button', { name: /Maç Kriterlerini Seç/ });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
