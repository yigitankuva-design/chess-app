import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Madde 2026-09-16 (Antrenör Ekranı, Faz C): canlı ders içinde Alt Konu
// seçimi route DEĞİŞTİRMEMELİ — `onSelectAltKonu` verilirse router.push
// yerine bu callback çağrılır.
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ role: 'teacher' }) }));

import { NestedSectionAccordion } from '@/components/custom/NestedSectionAccordion';
import type { CustomTabSection } from '@/lib/customTabsApi';

const SECTIONS: CustomTabSection[] = [
  {
    id: 200, order_index: 1, title: 'Dersler', body: '', images: [],
    practice_positions: [], parent_id: null, section_kind: 'dersler_root',
  },
  { id: 201, order_index: 1, title: 'Temel Düzey', body: '', images: [], practice_positions: [], parent_id: 200 },
  { id: 202, order_index: 1, title: 'Tahta ve Taşlar', body: '', images: [], practice_positions: [], parent_id: 201 },
  {
    id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', body: '', images: [],
    practice_positions: [], parent_id: 202,
  },
];

function openToAltKonu() {
  fireEvent.click(screen.getByText('Dersler'));
  fireEvent.click(screen.getByText('Temel Düzey'));
  fireEvent.click(screen.getByText('Tahta ve Taşlar'));
  fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
}

it('onSelectAltKonu verilmezse eski davranış (router.push) korunur', () => {
  render(<NestedSectionAccordion tabId={5} sections={SECTIONS} parentId={null} depth={0} />);
  openToAltKonu();
  expect(push).toHaveBeenCalledWith('/custom/5/alt-konu/203');
});

it('onSelectAltKonu verilirse router.push YERİNE bu çağrılır', () => {
  push.mockClear();
  const onSelectAltKonu = vi.fn();
  render(<NestedSectionAccordion tabId={5} sections={SECTIONS} parentId={null} depth={0} onSelectAltKonu={onSelectAltKonu} />);
  openToAltKonu();
  expect(onSelectAltKonu).toHaveBeenCalledWith(203);
  expect(push).not.toHaveBeenCalled();
});
