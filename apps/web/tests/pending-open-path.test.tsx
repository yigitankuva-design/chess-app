import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { writePendingOpenPath, readAndClearPendingOpenPath } from '@/lib/customTabs/pendingOpenPath';
import { CustomTabPanel } from '@/components/custom/CustomTabPanel';
import type { CustomTabDetail } from '@/lib/customTabsApi';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('lib/customTabs/pendingOpenPath — madde 2026-08-25', () => {
  it('yazılan yol, doğru tabId ile okununca döner ve SİLİNİR (tek seferlik)', () => {
    writePendingOpenPath({ tabId: 5, path: [200, 201, 202] });
    expect(readAndClearPendingOpenPath(5)).toEqual([200, 201, 202]);
    // İkinci okuma boş — bir kere kullanılıp silindi.
    expect(readAndClearPendingOpenPath(5)).toBeUndefined();
  });

  it('farklı bir tabId için okunursa undefined döner (ve yine silinir)', () => {
    writePendingOpenPath({ tabId: 5, path: [200] });
    expect(readAndClearPendingOpenPath(9)).toBeUndefined();
  });

  it('hiç yazılmamışsa undefined döner', () => {
    expect(readAndClearPendingOpenPath(5)).toBeUndefined();
  });
});

describe('CustomTabPanel + NestedSectionAccordion — Alt Konu sayfasından dönünce zincir AÇIK gelir', () => {
  const tab: CustomTabDetail = {
    id: 5, label: 'Antrenör', emoji: '🎓',
    sections: [
      { id: 200, order_index: 1, title: 'Dersler', body: '', images: [], practice_positions: [], parent_id: null },
      { id: 201, order_index: 1, title: 'Temel Düzey', body: '', images: [], practice_positions: [], parent_id: 200 },
      { id: 202, order_index: 1, title: 'Tahta ve Taşlar', body: 'Konu yazısı', images: [], practice_positions: [], parent_id: 201 },
      { id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', body: '', images: [], practice_positions: [], parent_id: 202 },
    ],
  };

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('bekleyen yol YOKKEN her şey kapalı başlar (mevcut davranış bozulmaz)', () => {
    render(<CustomTabPanel tab={tab} />);
    expect(screen.queryByText('Temel Düzey')).not.toBeInTheDocument();
  });

  it('bekleyen yol VARKEN Dersler→Düzey→Konu zinciri AÇIK başlar, Alt Konu görünür', async () => {
    writePendingOpenPath({ tabId: 5, path: [200, 201, 202] });
    render(<CustomTabPanel tab={tab} />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.getByText('Temel Düzey')).toBeInTheDocument();
    expect(screen.getByText('Tahta ve Taşlar')).toBeInTheDocument();
    expect(screen.getByText('Konu yazısı')).toBeInTheDocument();
  });

  it('başka bir sekmeye (tabId uyuşmayan) ait bekleyen yol UYGULANMAZ', () => {
    writePendingOpenPath({ tabId: 999, path: [200, 201, 202] });
    render(<CustomTabPanel tab={tab} />);
    expect(screen.queryByText('Temel Düzey')).not.toBeInTheDocument();
  });
});
