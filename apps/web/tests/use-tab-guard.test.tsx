import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { useTabGuard } from '@/lib/settings/useTabGuard';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

// useSettings mock'unu test bazında değiştirebilmek için değişken üzerinden kontrol ediyoruz
let mockTabs = { play: true, analiz: true, eglence: true };
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({ settings: { tabs: mockTabs } }),
}));

function Guarded({ tabKey }: { tabKey: 'play' | 'analiz' | 'eglence' }) {
  useTabGuard(tabKey);
  return <div>içerik</div>;
}

describe('useTabGuard', () => {
  beforeEach(() => { replaceMock.mockClear(); });

  it('sekme açıkken yönlendirme yapmaz', () => {
    mockTabs = { play: true, analiz: true, eglence: true };
    render(<Guarded tabKey="analiz" />);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('sekme admin panelinden kapatılmışsa /home\'a yönlendirir', () => {
    mockTabs = { play: true, analiz: false, eglence: true };
    render(<Guarded tabKey="analiz" />);
    expect(replaceMock).toHaveBeenCalledWith('/home');
  });

  it('sadece ilgili sekme kapalıyken yönlendirir, diğerlerini etkilemez', () => {
    mockTabs = { play: true, analiz: true, eglence: false };
    render(<Guarded tabKey="play" />);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
