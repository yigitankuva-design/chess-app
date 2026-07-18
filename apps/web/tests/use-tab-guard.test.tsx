import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { useTabGuard } from '@/lib/settings/useTabGuard';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

// useSettings mock'unu test bazında değiştirebilmek için değişken üzerinden kontrol ediyoruz
let mockTabs = { play: true, puzzle: true, badges: true };
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({ settings: { tabs: mockTabs } }),
}));

function Guarded({ tabKey }: { tabKey: 'play' | 'puzzle' | 'badges' }) {
  useTabGuard(tabKey);
  return <div>içerik</div>;
}

describe('useTabGuard', () => {
  beforeEach(() => { replaceMock.mockClear(); });

  it('sekme açıkken yönlendirme yapmaz', () => {
    mockTabs = { play: true, puzzle: true, badges: true };
    render(<Guarded tabKey="puzzle" />);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('sekme admin panelinden kapatılmışsa /home\'a yönlendirir', () => {
    mockTabs = { play: true, puzzle: false, badges: true };
    render(<Guarded tabKey="puzzle" />);
    expect(replaceMock).toHaveBeenCalledWith('/home');
  });

  it('sadece ilgili sekme kapalıyken yönlendirir, diğerlerini etkilemez', () => {
    mockTabs = { play: true, puzzle: true, badges: false };
    render(<Guarded tabKey="play" />);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
