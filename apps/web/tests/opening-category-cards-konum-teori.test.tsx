import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));

import { OpeningCategoryCards } from '@/components/admin/OpeningCategoryCards';
import type { KonumPratigiQuestion, TeoriPratigiQuestion } from '@/lib/customTabsApi';

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] } as Response)) as unknown as typeof fetch;
});

function openIcerikVeKart(kart: 'a' | 'b') {
  fireEvent.click(screen.getByRole('button', { name: /Açılış Pratiği İçeriği kartını aç/ }));
  fireEvent.click(screen.getByRole('button', {
    name: kart === 'a' ? /a\) Açılışı Tahmin Et kartını aç/ : /b\) Açılış Teorisini Hatırla kartını aç/,
  }));
}

const KONUM_Q: KonumPratigiQuestion = {
  id: 'q1', code: '001', instruction: 'Bu hangi açılıştır?',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  answer_kind: 'sentence', options: ['A', 'B'], correct_index: 0,
};

const TEORI_Q: TeoriPratigiQuestion = {
  id: 't1', code: '001', instruction: 'İlk hamleleri oyna',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e4'], opening_name: 'İtalyan Açılışı', student_color: 'w',
};

describe('OpeningCategoryCards — a) Konum Pratiği paneli (madde: Kazanç Konumu ile AYNI havuz deseni)', () => {
  it('gerekli callback\'lerden biri eksikse (henüz yüklenmediyse) "Yükleniyor..." gösterir', () => {
    render(<OpeningCategoryCards color="#38bdf8"
      konumPool={[]} onAddKonumQuestion={vi.fn()} onDeleteKonumQuestion={vi.fn()}
      // onUpdateKonumQuestion EKSİK — hâlâ yüklenme durumu sayılır.
    />);
    openIcerikVeKart('a');
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('havuz boşsa "Konum Havuzu" kartı 0 gösterir, ekle formu her zaman görünür', () => {
    render(<OpeningCategoryCards color="#38bdf8"
      konumPool={[]} onAddKonumQuestion={vi.fn()} onUpdateKonumQuestion={vi.fn()} onDeleteKonumQuestion={vi.fn()}
    />);
    openIcerikVeKart('a');
    expect(screen.getByText('Konum Havuzu').closest('button')).toHaveTextContent('0');
    // Madde 2026-09-06 (üçüncü tur/2): "Talimat" alanı kalktı — ekle formunun
    // göründüğünü FEN alanıyla doğrula.
    expect(screen.getByPlaceholderText(/FEN yapıştır/)).toBeInTheDocument();
  });

  it('havuz doluysa "Konum Havuzu" kartı açılınca SADECE kod numarası görünür (Kazanç Konumu ile AYNI ızgara)', () => {
    const onDelete = vi.fn();
    render(<OpeningCategoryCards color="#38bdf8"
      konumPool={[KONUM_Q]} onAddKonumQuestion={vi.fn()} onUpdateKonumQuestion={vi.fn()} onDeleteKonumQuestion={onDelete}
    />);
    openIcerikVeKart('a');
    fireEvent.click(screen.getByText('Konum Havuzu'));
    expect(screen.getByRole('button', { name: 'Soru 001' })).toBeInTheDocument();
    // Zafer'in isteği: havuz ızgarasında sadece kod numarası olsun, talimat gösterilmez.
    expect(screen.queryByText('Bu hangi açılıştır?')).not.toBeInTheDocument();

    // Koda tıklayınca düzenleme açılır, Sil orada görünür.
    fireEvent.click(screen.getByRole('button', { name: 'Soru 001' }));
    fireEvent.click(screen.getByRole('button', { name: /001 kodlu Konum Pratiği sorusunu sil/ }));
    expect(onDelete).toHaveBeenCalledWith('q1');
  });
});

describe('OpeningCategoryCards — b) Teori Pratiği paneli (madde: Kazanç Konumu ile AYNI havuz deseni)', () => {
  it('gerekli callback\'lerden biri eksikse "Yükleniyor..." gösterir', () => {
    render(<OpeningCategoryCards color="#38bdf8"
      teoriPool={[]} onAddTeoriQuestion={vi.fn()} onDeleteTeoriQuestion={vi.fn()}
      // onUpdateTeoriQuestion EKSİK.
    />);
    openIcerikVeKart('b');
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('havuz doluysa "Konum Havuzu" kartı açılınca SADECE kod numarası görünür, Sil düzenlemede çalışır', () => {
    const onDelete = vi.fn();
    render(<OpeningCategoryCards color="#38bdf8"
      teoriPool={[TEORI_Q]} onAddTeoriQuestion={vi.fn()} onUpdateTeoriQuestion={vi.fn()} onDeleteTeoriQuestion={onDelete}
    />);
    openIcerikVeKart('b');
    fireEvent.click(screen.getByText('Konum Havuzu'));
    expect(screen.getByRole('button', { name: 'Soru 001' })).toBeInTheDocument();
    // Zafer'in isteği: havuz ızgarasında sadece kod numarası olsun, açılış adı gösterilmez.
    expect(screen.queryByText('İtalyan Açılışı')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Soru 001' }));
    fireEvent.click(screen.getByRole('button', { name: /001 kodlu Teori Pratiği sorusunu sil/ }));
    expect(onDelete).toHaveBeenCalledWith('t1');
  });
});
