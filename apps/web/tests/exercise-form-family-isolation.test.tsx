import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

// PoolPicker havuzu fetch'ler; bos liste yeterli.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
});

/** Yeni formun varsayilan bolumu KONUM'dur (familyOf(undefined) => 'konum');
 *  Cumle'ye gecis testin ilk adimidir. "Soru cumlesi" alani yalnizca Cumle'de
 *  cizilir; iki bolumde de ortak olan alan SIKLARDIR ("1. şık"). */
const INSTR = /Soru cümlesi/;
const OPT1 = '1. şık';

describe('ExerciseForm — bölüm bağımsızlığı', () => {
  it("Cümle'ye yazılan şık Görüntü'ye SIZMAZ", () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Cümle ekle'));
    fireEvent.change(screen.getByPlaceholderText(OPT1), {
      target: { value: 'At L şeklinde gider' },
    });
    fireEvent.click(screen.getByText('Görüntü ekle'));
    expect(screen.getByPlaceholderText(OPT1)).toHaveValue('');
  });

  it("Cümle taslağı Görüntü'ye gidip DÖNÜNCE geri gelir", () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Cümle ekle'));
    fireEvent.change(screen.getByPlaceholderText(INSTR), {
      target: { value: 'Atın hareketi nasıldır?' },
    });
    fireEvent.click(screen.getByText('Görüntü ekle'));
    fireEvent.click(screen.getByText('Cümle ekle'));
    expect(screen.getByPlaceholderText(INSTR)).toHaveValue('Atın hareketi nasıldır?');
  });

  it("Konum'a gidip dönünce de Cümle taslağı durur", () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Cümle ekle'));
    fireEvent.change(screen.getByPlaceholderText(INSTR), {
      target: { value: 'Kale kaç kare gider?' },
    });
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.getByText('Kareye tıkla')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cümle ekle'));
    expect(screen.getByPlaceholderText(INSTR)).toHaveValue('Kale kaç kare gider?');
  });

  it('Görüntü taslağı ile Cümle taslağı AYRIDIR', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Cümle ekle'));
    fireEvent.change(screen.getByPlaceholderText(OPT1), {
      target: { value: 'cümle-şıkkı' },
    });
    fireEvent.click(screen.getByText('Görüntü ekle'));
    fireEvent.change(screen.getByPlaceholderText(OPT1), {
      target: { value: 'görüntü-şıkkı' },
    });
    fireEvent.click(screen.getByText('Cümle ekle'));
    expect(screen.getByPlaceholderText(OPT1)).toHaveValue('cümle-şıkkı');
    fireEvent.click(screen.getByText('Görüntü ekle'));
    expect(screen.getByPlaceholderText(OPT1)).toHaveValue('görüntü-şıkkı');
  });
});
