import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AltKonuExplanationCardsFields } from '@/components/admin/AltKonuExplanationCardsFields';
import type { ExplanationCard } from '@/lib/customTabsApi';

describe('AltKonuExplanationCardsFields — madde 2026-08-25', () => {
  it('kart yokken sadece ekleme formu görünür', () => {
    render(<AltKonuExplanationCardsFields cards={[]} onAdd={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByPlaceholderText('Bu konumla ilgili açıklama cümlesi')).toBeInTheDocument();
    expect(screen.getByText('Kart Ekle')).toBeDisabled();
  });

  it('kayıtlı kartlar 1\'den başlayarak numaralı listelenir', () => {
    const cards: ExplanationCard[] = [
      { id: 'c1', fen: 'x', sentence: 'Birinci cümle.' },
      { id: 'c2', fen: 'x', sentence: 'İkinci cümle.' },
    ];
    render(<AltKonuExplanationCardsFields cards={cards} onAdd={vi.fn()} onDelete={vi.fn()} />);
    const list = screen.getByRole('list');
    expect(within(list).getByText('Birinci cümle.')).toBeInTheDocument();
    expect(within(list).getByText('İkinci cümle.')).toBeInTheDocument();
    expect(within(list).getByText('1')).toBeInTheDocument();
    expect(within(list).getByText('2')).toBeInTheDocument();
  });

  it('cümle yazıp Kart Ekle\'ye basınca onAdd bir fen+sentence ile çağrılır', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AltKonuExplanationCardsFields cards={[]} onAdd={onAdd} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Bu konumla ilgili açıklama cümlesi'), {
      target: { value: 'Tahta 8x8 karelerden oluşur.' },
    });
    fireEvent.click(screen.getByText('Kart Ekle'));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const arg = onAdd.mock.calls[0][0];
    expect(arg.sentence).toBe('Tahta 8x8 karelerden oluşur.');
    expect(typeof arg.fen).toBe('string');
    expect(arg.fen.length).toBeGreaterThan(0);
  });

  it('Sil butonuna basınca onDelete doğru kart id\'siyle çağrılır', () => {
    const onDelete = vi.fn();
    const cards: ExplanationCard[] = [{ id: 'c1', fen: 'x', sentence: 'Cümle.' }];
    render(<AltKonuExplanationCardsFields cards={cards} onAdd={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('1. açıklama kartını sil'));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });
});
