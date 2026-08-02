import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — Kareye Tıkla tıklama modu (madde 2)', () => {
  it('konum + Konumu Kaydet sonrası iki mod butonu görünür', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(screen.getByText('Tek Kareye Tıklaması Yeterli')).toBeInTheDocument();
    expect(screen.getByText('Tüm Cevap Karelerine Tıklasın')).toBeInTheDocument();
  });
});
