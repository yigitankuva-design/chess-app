'use client';
import Link from 'next/link';

interface Props {
  emoji: string;
  title: string;
  description: string;
}

/** İçeriği henüz tanımlanmamış sekmeler için tema uyumlu "Yakında" ekranı. */
export function ComingSoon({ emoji, title, description }: Props) {
  return (
    <main id="main-content" className="px-4 pt-16 pb-12 max-w-md mx-auto text-center">
      <div className="text-6xl mb-4">{emoji}</div>
      <h1 className="text-2xl font-extrabold t-premium mb-2">{title}</h1>
      <p className="t-muted text-sm mb-8">{description}</p>
      <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold t-muted border border-[var(--t-accent)]"
        style={{ background: 'color-mix(in srgb, var(--t-accent) 8%, transparent)' }}>
        Yakında
      </span>
      <div className="mt-10">
        <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">
          Ana Sayfaya Dön
        </Link>
      </div>
    </main>
  );
}
