import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi Faz 2): Alt Konu ↔ Dersler müfredatı köprüsü
// admin arayüzü — bağ seçici + "Otomatik Eşleştir" paneli.
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));

const catalog = [
  {
    module_id: 1, module_name: 'Temel Düzey', order_index: 1,
    lessons: [
      {
        lesson_id: 10, title: 'Tahta ve Taşlar', order_index: 1,
        steps: [
          { step_id: 100, title: 'Tahtanın Özellikleri', order_index: 1 },
          { step_id: 101, title: 'Merkez', order_index: 2 },
        ],
      },
    ],
  },
];

const mocks = vi.hoisted(() => ({
  fetchLessonStepCatalog: vi.fn(),
  autoMatchLessonLinks: vi.fn(),
  updateCustomTabSection: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('@/lib/customTabsApi', () => mocks);

import {
  AltKonuLessonLinkPicker, LessonLinkAutoMatchPanel, _resetLessonCatalogCache,
} from '@/components/admin/LessonLinkAdmin';

beforeEach(() => {
  vi.clearAllMocks();
  _resetLessonCatalogCache();
  mocks.fetchLessonStepCatalog.mockResolvedValue(catalog);
});

describe('AltKonuLessonLinkPicker', () => {
  it('bağ YOKKEN kırmızı "müfredata bağlı değil" uyarısı + seçim kutusu gösterir', async () => {
    render(<AltKonuLessonLinkPicker linkedStepId={null} onChange={vi.fn()} />);
    expect(screen.getByText(/müfredata bağlı değil/)).toBeInTheDocument();
    await waitFor(() => screen.getByLabelText('Bağlanacak ders alt konusu'));
    // optgroup "Düzey › Konu" + option başlıkları.
    expect(screen.getByRole('option', { name: 'Tahtanın Özellikleri' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Merkez' })).toBeInTheDocument();
  });

  it('bağ VARKEN "✓ Bağlı" + "Düzey › Konu › Alt Konu" etiketini katalogdan çözer', async () => {
    render(<AltKonuLessonLinkPicker linkedStepId={101} onChange={vi.fn()} />);
    await waitFor(() => screen.getByText('Temel Düzey › Tahta ve Taşlar › Merkez'));
    expect(screen.getByText('✓ Bağlı')).toBeInTheDocument();
    expect(screen.queryByText(/müfredata bağlı değil/)).not.toBeInTheDocument();
  });

  it('seçim kutusundan adım seçilince onChange(step_id) çağrılır', async () => {
    const onChange = vi.fn();
    render(<AltKonuLessonLinkPicker linkedStepId={null} onChange={onChange} />);
    const select = await waitFor(() => screen.getByLabelText('Bağlanacak ders alt konusu'));
    fireEvent.change(select, { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('bağlıyken "Bağı kaldır" onChange(null) çağırır', async () => {
    const onChange = vi.fn();
    render(<AltKonuLessonLinkPicker linkedStepId={100} onChange={onChange} />);
    await waitFor(() => screen.getByText('✓ Bağlı'));
    fireEvent.click(screen.getByText('Bağı kaldır'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('LessonLinkAutoMatchPanel', () => {
  it('düğmeye basınca otomatik eşleştirir, ağacı tazeler ve raporu gösterir', async () => {
    mocks.autoMatchLessonLinks.mockResolvedValue({
      linked: [{ section_id: 1, section_title: 'A', duzey_title: 'D', konu_title: 'K' }],
      ambiguous: [],
      unmatched: [{ section_id: 2, section_title: 'B', duzey_title: 'D', konu_title: 'K' }],
      already_linked: 3,
      total: 6,
    });
    const onReloadTree = vi.fn(() => Promise.resolve());
    render(<LessonLinkAutoMatchPanel onReloadTree={onReloadTree} />);

    fireEvent.click(screen.getByRole('button', { name: 'Otomatik Eşleştir' }));
    await waitFor(() => screen.getByText(/1 yeni bağ kuruldu/));
    expect(mocks.autoMatchLessonLinks).toHaveBeenCalledTimes(1);
    expect(onReloadTree).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Eşleşmeyen \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('D › K › B')).toBeInTheDocument();
  });

  it('başarısızlıkta hata mesajı gösterir', async () => {
    mocks.autoMatchLessonLinks.mockResolvedValue(null);
    render(<LessonLinkAutoMatchPanel onReloadTree={vi.fn(() => Promise.resolve())} />);
    fireEvent.click(screen.getByRole('button', { name: 'Otomatik Eşleştir' }));
    await waitFor(() => screen.getByText('Otomatik eşleştirme başarısız oldu.'));
  });
});
