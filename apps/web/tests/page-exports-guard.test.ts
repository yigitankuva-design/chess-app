import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * ÜRETİM DERLEMESİ KORUMASI — 2026-08-28.
 *
 * Next.js App Router'da bir `page.tsx` yalnızca `default`'u ve kısa bir izinli
 * ad listesini (metadata, dynamic, revalidate...) export edebilir. Fazladan bir
 * bileşen export edilirse `npx next build` tip hatası verir ve Vercel yüklemesi
 * BAŞARISIZ olur — ama `tsc --noEmit`, lint ve vitest bunu YAKALAMAZ. O yüzden
 * turnuva sayfaları günlerce canlıya çıkamadı, kimse fark etmedi.
 *
 * Kural: görünüm bileşenini `components/` altına koy, sayfa onu import etsin
 * (örnek: play/online/[gameId]/page.tsx → components/LiveGame).
 */

const APP_DIR = join(__dirname, '..', 'app');

const ALLOWED_NAMES = new Set([
  'metadata', 'generateMetadata', 'generateStaticParams', 'dynamic',
  'dynamicParams', 'revalidate', 'fetchCache', 'runtime', 'preferredRegion',
  'maxDuration', 'viewport', 'generateViewport',
]);

/** `export default` DIŞINDA kalan, izinli listede olmayan export adları. */
export function disallowedExports(source: string): string[] {
  const found: string[] = [];
  const re = /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (!ALLOWED_NAMES.has(m[1])) found.push(m[1]);
  }
  return found;
}

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pageFiles(full));
    else if (entry.name === 'page.tsx' || entry.name === 'page.ts') out.push(full);
  }
  return out;
}

describe('page.tsx export koruması', () => {
  it('tarayıcı fazladan export edilen bileşeni yakalar', () => {
    const ornek = [
      "export default function Sayfa() { return null; }",
      "export function GorunumBileseni() { return null; }",
    ].join('\n');
    expect(disallowedExports(ornek)).toEqual(['GorunumBileseni']);
  });

  it('izinli Next alanlarını hatalı saymaz', () => {
    const ornek = [
      "export const dynamic = 'force-dynamic';",
      "export async function generateMetadata() { return {}; }",
      "export default function Sayfa() { return null; }",
    ].join('\n');
    expect(disallowedExports(ornek)).toEqual([]);
  });

  it('hiçbir page dosyası fazladan export etmiyor', () => {
    const offenders: string[] = [];
    for (const file of pageFiles(APP_DIR)) {
      const bad = disallowedExports(readFileSync(file, 'utf-8'));
      if (bad.length) offenders.push(`${relative(APP_DIR, file)} → ${bad.join(', ')}`);
    }
    expect(offenders, 'page.tsx yalnızca default export edebilir; bileşeni components/ altına taşı').toEqual([]);
  });
});
