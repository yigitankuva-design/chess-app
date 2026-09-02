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
    name: kart === 'a' ? /a\) Konum Pratiği kartını aç/ : /b\) Teori Pratiği kartını aç/,
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

describe('OpeningCategoryCards — a) Konum Pratiği paneli (madde 2026-09-02 devam)', () => {
  it('konumPool undefined iken "Yükleniyor..." gösterir', () => {
    render(<OpeningCategoryCards color="#38bdf8" />);
    openIcerikVeKart('a');
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('konumPool boşsa "Henüz soru eklenmedi." gösterir, form yine de görünür', () => {
    render(<OpeningCategoryCards color="#38bdf8"
      konumPool={[]} onAddKonumQuestion={vi.fn()} onDeleteKonumQuestion={vi.fn()}
    />);
    openIcerikVeKart('a');
    expect(screen.getByText('Henüz soru eklenmedi.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)')).toBeInTheDocument();
  });

  it('konumPool doluysa kod + talimat listelenir, Sil onDeleteKonumQuestion çağırır', () => {
    const onDelete = vi.fn();
    render(<OpeningCategoryCards color="#38bdf8"
      konumPool={[KONUM_Q]} onAddKonumQuestion={vi.fn()} onDeleteKonumQuestion={onDelete}
    />);
    openIcerikVeKart('a');
    expect(screen.getByText('001')).toBeInTheDocument();
    expect(screen.getByText('Bu hangi açılıştır?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /001 kodlu Konum Pratiği sorusunu sil/ }));
    expect(onDelete).toHaveBeenCalledWith('q1');
  });
});

describe('OpeningCategoryCards — b) Teori Pratiği paneli (madde 2026-09-02 devam)', () => {
  it('teoriPool undefined iken "Yükleniyor..." gösterir', () => {
    render(<OpeningCategoryCards color="#38bdf8" />);
    openIcerikVeKart('b');
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('teoriPool doluysa kod + açılış adı listelenir, Sil onDeleteTeoriQuestion çağırır', () => {
    const onDelete = vi.fn();
    render(<OpeningCategoryCards color="#38bdf8"
      teoriPool={[TEORI_Q]} onAddTeoriQuestion={vi.fn()} onDeleteTeoriQuestion={onDelete}
    />);
    openIcerikVeKart('b');
    expect(screen.getByText('001')).toBeInTheDocument();
    expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /001 kodlu Teori Pratiği sorusunu sil/ }));
    expect(onDelete).toHaveBeenCalledWith('t1');
  });
});
