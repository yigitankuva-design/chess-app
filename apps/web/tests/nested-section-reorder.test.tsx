import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/customTabsApi', () => ({
  createCustomTabSection: vi.fn(),
  updateCustomTabSection: vi.fn(() => Promise.resolve(true)),
  deleteCustomTabSection: vi.fn(() => Promise.resolve(true)),
  duplicateCustomTabSection: vi.fn(),
  reorderCustomTabSections: vi.fn(() => Promise.resolve(true)),
}));

import { NestedSectionTree } from '@/components/admin/NestedSectionTree';
import { reorderCustomTabSections } from '@/lib/customTabsApi';
import type { CustomTabSection } from '@/lib/customTabsApi';

const SECTIONS: CustomTabSection[] = [
  { id: 1, order_index: 1, title: 'Birinci', body: '', images: [] },
  { id: 2, order_index: 2, title: 'İkinci', body: '', images: [] },
  { id: 3, order_index: 3, title: 'Üçüncü', body: '', images: [] },
];

function setup() {
  const onReloadTree = vi.fn(() => Promise.resolve());
  render(
    <NestedSectionTree
      tabId={7} parentId={null} allSections={SECTIONS} depth={0}
      onSectionCreated={vi.fn()} onSectionUpdated={vi.fn()} onReloadTree={onReloadTree}
    />,
  );
  return { onReloadTree };
}

describe('NestedSectionTree — yukarı/aşağı sıralama (madde 2026-09-05 (4))', () => {
  it('ilk elemanın yukarı düğmesi disabled, son elemanın aşağı düğmesi disabled', () => {
    setup();
    expect(screen.getByLabelText('Birinci alt sekmesini yukarı taşı')).toBeDisabled();
    expect(screen.getByLabelText('Üçüncü alt sekmesini aşağı taşı')).toBeDisabled();
    expect(screen.getByLabelText('Birinci alt sekmesini aşağı taşı')).not.toBeDisabled();
    expect(screen.getByLabelText('Üçüncü alt sekmesini yukarı taşı')).not.toBeDisabled();
  });

  it('ortadaki eleman yukarı taşınınca doğru sırayla reorderCustomTabSections çağrılır', async () => {
    const { onReloadTree } = setup();
    fireEvent.click(screen.getByLabelText('İkinci alt sekmesini yukarı taşı'));
    await waitFor(() => expect(reorderCustomTabSections).toHaveBeenCalledWith(7, [2, 1, 3]));
    await waitFor(() => expect(onReloadTree).toHaveBeenCalled());
  });

  it('ortadaki eleman aşağı taşınınca doğru sırayla reorderCustomTabSections çağrılır', async () => {
    setup();
    fireEvent.click(screen.getByLabelText('İkinci alt sekmesini aşağı taşı'));
    await waitFor(() => expect(reorderCustomTabSections).toHaveBeenCalledWith(7, [1, 3, 2]));
  });
});
