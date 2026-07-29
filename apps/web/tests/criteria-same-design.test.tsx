import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepCard } from '@/components/play/StepCard';

/** Madde 5: kriter secim alani her bolumde AYNI cizilmeli. StepCard icinde
 *  gosterildiginde ustune bir kart daha binmemeli — yoksa alan daralir ve
 *  tasarim /play'deki halinden farkli gorunur. */
describe('StepCard — flush içerik (madde 5)', () => {
  it('normalde içerik yan boşlukla çizilir', () => {
    render(
      <StepCard title="Kriter" open onToggle={vi.fn()}>
        <div data-testid="ic">içerik</div>
      </StepCard>,
    );
    const kap = screen.getByTestId('ic').parentElement!;
    expect(kap.className).toContain('px-4');
  });

  it('flush verilince yan boşluk KALDIRILIR', () => {
    render(
      <StepCard title="Kriter" open flush onToggle={vi.fn()}>
        <div data-testid="ic">içerik</div>
      </StepCard>,
    );
    const kap = screen.getByTestId('ic').parentElement!;
    expect(kap.className).not.toContain('px-4');
  });

  it('flush kilit ve başlık davranışını değiştirmez', () => {
    render(
      <StepCard title="Kriter" stepNumber={2} open={false} flush locked onToggle={vi.fn()}>
        <div>içerik</div>
      </StepCard>,
    );
    const btn = screen.getByText('2. Kriter').closest('button')!;
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });
});
