import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/customTabsApi', () => ({
  createCustomTabSection: vi.fn(),
  updateCustomTabSection: vi.fn(() => Promise.resolve(true)),
  deleteCustomTabSection: vi.fn(() => Promise.resolve(true)),
  duplicateCustomTabSection: vi.fn(),
  reorderCustomTabSections: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/components/admin/AssignHomeworkPanel', () => ({
  AssignHomeworkPanel: ({ sourceSectionId, sourceSectionTitle }: { sourceSectionId: number; sourceSectionTitle: string }) => (
    <div data-testid="assign-homework-panel" data-section-id={sourceSectionId} data-section-title={sourceSectionTitle} />
  ),
}));

import { NestedSectionTree } from '@/components/admin/NestedSectionTree';
import type { CustomTabSection } from '@/lib/customTabsApi';

const ALT_KONU_SECTIONS: CustomTabSection[] = [
  { id: 55, order_index: 1, title: 'İtalyan Açılışı', body: '', images: [], practice_positions: [], position_pool: [] },
];

describe('NestedSectionTree — Alt Konu düğümünde "Ödev Ver" paneli (madde 2026-09-05)', () => {
  it('Alt Konu (Dersler altında 3. derinlik) açılınca AssignHomeworkPanel doğru section id/title ile render edilir', () => {
    render(
      <NestedSectionTree
        tabId={7} parentId={null} allSections={ALT_KONU_SECTIONS} depth={3}
        onSectionCreated={vi.fn()} onSectionUpdated={vi.fn()} onReloadTree={vi.fn(() => Promise.resolve())}
        inDersler
      />,
    );
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    const panel = screen.getByTestId('assign-homework-panel');
    expect(panel).toHaveAttribute('data-section-id', '55');
    expect(panel).toHaveAttribute('data-section-title', 'İtalyan Açılışı');
  });

  it('Alt Konu DEĞİLKEN (normal iç içe bölüm) AssignHomeworkPanel gösterilmez', () => {
    render(
      <NestedSectionTree
        tabId={7} parentId={null} allSections={ALT_KONU_SECTIONS} depth={1}
        onSectionCreated={vi.fn()} onSectionUpdated={vi.fn()} onReloadTree={vi.fn(() => Promise.resolve())}
      />,
    );
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    expect(screen.queryByTestId('assign-homework-panel')).not.toBeInTheDocument();
  });
});
