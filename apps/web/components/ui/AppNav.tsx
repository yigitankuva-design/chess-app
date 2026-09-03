'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useBackOverrideHandler } from '@/lib/nav/backOverride';

interface NavConfig {
  title: string;
  back: string | null;
  rightHref: string;
  rightIcon: 'home' | 'profile';
}

function getConfig(pathname: string): NavConfig {
  if (pathname === '/home')
    return { title: '', back: null, rightHref: '/profile', rightIcon: 'profile' };
  if (pathname.startsWith('/lesson/'))
    return { title: 'Ders', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/modules/'))
    return { title: 'Dersler', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/play/online/'))
    return { title: 'Online Oyun', back: '/play/online', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/play/online'))
    return { title: 'Online Oyna', back: '/play', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/play'))
    return { title: 'Oyna', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/puzzle'))
    return { title: 'Bulmaca', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/analiz'))
    return { title: 'Analiz Et', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/eglence'))
    return { title: 'Eğlence', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/pratik'))
    return { title: 'Pratik', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/daily'))
    return { title: 'Günün Bulmacası', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/srs'))
    return { title: 'Tekrar', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/badges'))
    return { title: 'Rozetler', back: '/home', rightHref: '/home', rightIcon: 'home' };
  if (pathname.startsWith('/profile'))
    return { title: 'Profil', back: '/home', rightHref: '/home', rightIcon: 'home' };
  // Madde 2026-09-04 (4): /custom/* sayfalarının KENDİ geri butonu kaldırıldı
  // (uygulama genelinde TEK geri butonu kuralı) — bu satır olmadan bu
  // sayfalarda geri dönme imkânı hiç kalmazdı (varsayılan `back: null`).
  if (pathname.startsWith('/custom'))
    return { title: '', back: '/home', rightHref: '/home', rightIcon: 'home' };
  return { title: '', back: null, rightHref: '/profile', rightIcon: 'profile' };
}

const IconChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconProfile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { title, back, rightHref, rightIcon } = getConfig(pathname);
  /** Madde 2026-09-04 (4): bazı sayfaların (ör. custom/[id]/alt-konu/[sectionId])
   *  "geri" işlemi düz navigasyon değil, özel bir mantık gerektiriyor — bkz.
   *  lib/nav/backOverride.tsx. Doluysa AŞAĞIDAKİ TEK buton varsayılan
   *  davranış YERİNE bunu çağırır; sayfa KENDİ butonunu ÇİZMEZ. */
  const overrideHandler = useBackOverrideHandler();

  const navTextStyle = { color: 'var(--t-nav-text)' } as React.CSSProperties;

  // Geri: bir önceki sayfaya dön (en başa değil). Tarayıcı geçmişi yoksa
  // yapılandırılmış geri hedefine (genelde /home) düş. Özel mantık kayıtlıysa
  // (overrideHandler) o öncelikli.
  function handleBack() {
    if (overrideHandler) { overrideHandler(); return; }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(back ?? '/home');
    }
  }

  return (
    <nav
      className="t-nav sticky top-0 z-50 flex items-center h-12 px-3 gap-2 select-none"
      role="navigation"
      aria-label="Uygulama navigasyonu"
    >
      {/* Left */}
      <div className="w-9 flex items-center justify-start flex-shrink-0">
        {(back || overrideHandler) && (
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-colors hover:opacity-80 active:scale-95"
            style={{ border: '2px solid var(--t-accent)', color: 'var(--t-accent)' }}
            aria-label="Geri"
          >
            <IconChevronLeft />
          </button>
        )}
      </div>

      {/* Center title */}
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        {title === '' ? (
          <>
            <Image src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" width={640} height={640}
              className="h-6 w-auto flex-shrink-0" />
            <span className="text-sm font-extrabold tracking-wide truncate t-premium">
              Bozüyük Satranç Akademisi
            </span>
          </>
        ) : (
          <p className="text-sm font-bold tracking-wide truncate t-premium">
            {title}
          </p>
        )}
      </div>

      {/* Right */}
      <div className="w-9 flex items-center justify-end flex-shrink-0">
        <Link
          href={rightHref}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/10 active:bg-white/20"
          style={navTextStyle}
          aria-label={rightIcon === 'home' ? 'Ana Sayfa' : 'Profil'}
        >
          {rightIcon === 'home' ? <IconHome /> : <IconProfile />}
        </Link>
      </div>
    </nav>
  );
}
