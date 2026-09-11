'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchNotifications, markNotificationVisited, NOTIFICATION_TYPE_META, odevTargetHref,
} from '@/lib/notificationsApi';
import type { NotificationItem } from '@/lib/notificationsApi';

/**
 * Madde 2026-09-11 (Ödev Sistemi Faz 4): sporcunun genel amaçlı bildirim
 * gelen kutusu. En yeni bildirim üstte. "Git" (kağıt uçak) düğmesi HENÜZ
 * gidilmemiş bildirimlerde YEŞİL, gidilmiş olanlarda KIRMIZI — düğmeye
 * basmak yeterli (Zafer'in isteği). Ziyaret edilmemiş satırlar hafifçe
 * vurgulanır ve "YENİ" etiketi taşır.
 */
function PaperPlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l16-8-6 16-3-6-7-2z" />
      <path d="M20 4l-9 9" />
    </svg>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function BildirimlerPage() {
  const router = useRouter();
  const [data, setData] = useState<{ unread_count: number; items: NotificationItem[] } | null>(null);

  useEffect(() => { fetchNotifications().then(setData); }, []);

  async function handleGit(item: NotificationItem) {
    // Madde: "butona basması yeterli" — tür ne olursa olsun ziyaret işaretlenir.
    setData((prev) => prev && {
      unread_count: item.visited_at ? prev.unread_count : Math.max(0, prev.unread_count - 1),
      items: prev.items.map((i) => (i.id === item.id ? { ...i, visited_at: i.visited_at ?? new Date().toISOString() } : i)),
    });
    void markNotificationVisited(item.id);
    if (item.type === 'odev' && item.target) {
      router.push(odevTargetHref(item.target));
    }
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold t-premium">Bildirimler</h1>
        {data && data.unread_count > 0 && (
          <p className="text-sm t-muted mt-1">{data.unread_count} yeni bildirim</p>
        )}
      </div>

      {data === null && <p className="t-muted text-sm">Yükleniyor…</p>}
      {data !== null && data.items.length === 0 && (
        <p className="t-muted text-sm">Henüz bildirim yok.</p>
      )}

      <div className="space-y-2">
        {data?.items.map((item) => {
          const unread = item.visited_at === null;
          const meta = NOTIFICATION_TYPE_META[item.type];
          return (
            <div key={item.id}
              className="t-card p-3 flex items-center gap-3"
              style={unread ? { background: 'var(--t-surface-2)', border: '1px solid var(--t-accent)' } : undefined}>
              <span className="text-2xl flex-shrink-0" aria-hidden="true">{meta.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold truncate">{item.title}</span>
                  {unread && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
                      YENİ
                    </span>
                  )}
                </div>
                {item.subtitle && <p className="text-xs t-muted truncate">{item.subtitle}</p>}
                <p className="text-[11px] t-muted mt-0.5">{formatDate(item.created_at)}</p>
              </div>
              <button type="button" onClick={() => handleGit(item)}
                aria-label={unread ? `${item.title} — Git` : `${item.title} — tekrar git`}
                title="Git"
                className="rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  width: 40, height: 40,
                  background: unread ? '#22c55e' : '#ef4444',
                  border: '2px solid #0a0a0a',
                }}>
                <PaperPlaneIcon />
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
