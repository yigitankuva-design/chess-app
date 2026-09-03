import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const back = vi.fn();
const push = vi.fn();
let pathname = '/home';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ back, push }),
}));

import { AppNav } from '@/components/ui/AppNav';
import { BackOverrideProvider, useBackOverride } from '@/lib/nav/backOverride';

describe('AppNav — madde 2026-09-04 (4): uygulama genelinde TEK geri butonu', () => {
  beforeEach(() => {
    back.mockClear();
    push.mockClear();
    // jsdom varsayılanı: history.length genelde 1 — "geçmiş var" senaryosunu
    // test etmek için bazı testlerde ayrıca ayarlanır.
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
      configurable: true,
    });
  });

  it('/home\'da geri butonu YOK (logo/başlık görünür)', () => {
    pathname = '/home';
    render(<AppNav />);
    expect(screen.queryByLabelText('Geri')).not.toBeInTheDocument();
    expect(screen.getByText('Bozüyük Satranç Akademisi')).toBeInTheDocument();
  });

  it('/play sayfasında geri butonu KALICI/görünür bir dairesel rozettir (sadece hover değil)', () => {
    pathname = '/play';
    render(<AppNav />);
    const btn = screen.getByLabelText('Geri');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveStyle({ borderStyle: 'solid' });
  });

  it('tarayıcı geçmişi varken tıklanınca router.back() çağrılır', () => {
    pathname = '/analiz';
    Object.defineProperty(window, 'history', { value: { length: 3 }, writable: true, configurable: true });
    render(<AppNav />);
    fireEvent.click(screen.getByLabelText('Geri'));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('tarayıcı geçmişi yokken yapılandırılmış hedefe (ör. /home) düşer', () => {
    pathname = '/analiz';
    Object.defineProperty(window, 'history', { value: { length: 1 }, writable: true, configurable: true });
    render(<AppNav />);
    fireEvent.click(screen.getByLabelText('Geri'));
    expect(push).toHaveBeenCalledWith('/home');
  });

  it('madde: /custom/* artık geri butonuna sahip (önceden HİÇ yoktu)', () => {
    pathname = '/custom/5';
    render(<AppNav />);
    expect(screen.getByLabelText('Geri')).toBeInTheDocument();
  });

  it('bir sayfa useBackOverride ile özel mantık kaydettiyse, buton onu çağırır — router.back() DEĞİL', () => {
    pathname = '/custom/5/alt-konu/9';
    const customBack = vi.fn();
    function PageStub() {
      useBackOverride(customBack);
      return null;
    }
    render(
      <BackOverrideProvider>
        <AppNav />
        <PageStub />
      </BackOverrideProvider>,
    );
    fireEvent.click(screen.getByLabelText('Geri'));
    expect(customBack).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
