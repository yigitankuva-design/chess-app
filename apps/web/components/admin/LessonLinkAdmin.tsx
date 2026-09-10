'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchLessonStepCatalog, autoMatchLessonLinks, updateCustomTabSection,
} from '@/lib/customTabsApi';
import type {
  LessonStepCatalogModule, LessonLinkAutoMatchReport,
} from '@/lib/customTabsApi';

/**
 * Madde 2026-09-11 (Ödev Sistemi Faz 2): Antrenör "Çalışmalar/Dersler"
 * ağacındaki bir Alt Konu'yu anlatırken "Ödev Gönder"e basınca ödev olarak
 * giden şey, o Alt Konu'nun Dersler MÜFREDATINDAKİ karşılığıdır (bir
 * LessonStep). Bu köprüyü admin burada kurar:
 *  - `<AltKonuLessonLinkPicker>` — tek bir Alt Konu için bağ seçici.
 *  - `<LessonLinkAutoMatchPanel>` — "Dersler" kökünde, başlık eşleşmesiyle
 *    hepsini bir kerede bağlayan düğme + kalanların raporu.
 *
 * Katalog (Düzey→Konu→Alt Konu ağacı) BİR KEZ çekilir (modül seviyesi cache);
 * bağ değişince ağaçtaki section verisi `onReloadTree` ile tazelenir.
 */

let _catalogPromise: Promise<LessonStepCatalogModule[]> | null = null;
function loadCatalog(): Promise<LessonStepCatalogModule[]> {
  if (!_catalogPromise) _catalogPromise = fetchLessonStepCatalog();
  return _catalogPromise;
}
/** Auto-match veya elle değişiklik sonrası katalog metinleri değişmez
 *  (sadece bağlar) ama testler/temizlik için sıfırlanabilir. */
export function _resetLessonCatalogCache() { _catalogPromise = null; }

/** step_id -> "Düzey › Konu › Alt Konu" etiketi */
function buildStepLabels(catalog: LessonStepCatalogModule[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const mod of catalog) {
    for (const lesson of mod.lessons) {
      for (const step of lesson.steps) {
        m.set(step.step_id, `${mod.module_name} › ${lesson.title} › ${step.title}`);
      }
    }
  }
  return m;
}

interface PickerProps {
  linkedStepId: number | null;
  /** Bağ değişince — number = bağla, null = bağı kaldır. */
  onChange: (stepId: number | null) => void;
}

export function AltKonuLessonLinkPicker({ linkedStepId, onChange }: PickerProps) {
  const [catalog, setCatalog] = useState<LessonStepCatalogModule[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadCatalog().then(setCatalog); }, []);

  const labels = useMemo(() => buildStepLabels(catalog ?? []), [catalog]);
  const currentLabel = linkedStepId != null ? labels.get(linkedStepId) ?? `#${linkedStepId}` : null;

  async function apply(next: number | null) {
    setBusy(true);
    onChange(next);
    setEditing(false);
    setBusy(false);
  }

  const hasSteps = (catalog ?? []).some((m) => m.lessons.some((l) => l.steps.length > 0));

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <p className="text-xs font-bold n-muted uppercase tracking-widest">Müfredat Köprüsü (Ödev)</p>
      {linkedStepId != null && !editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded-md bg-emerald-400/15 text-emerald-200 border border-emerald-400/40">
            ✓ Bağlı
          </span>
          <span className="text-sm n-text">{currentLabel}</span>
          <button type="button" onClick={() => setEditing(true)} disabled={busy}
            className="px-2 py-1 rounded-md text-cyan-300 hover:bg-cyan-400/10 text-xs">
            Değiştir
          </button>
          <button type="button" onClick={() => apply(null)} disabled={busy}
            className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">
            Bağı kaldır
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {linkedStepId == null && (
            <p className="text-xs px-2 py-1 rounded-md bg-rose-500/15 text-rose-200 border border-rose-400/40 inline-block">
              ⚠ Bu alt konu müfredata bağlı değil — &quot;Ödev Gönder&quot; devre dışı
            </p>
          )}
          {catalog == null ? (
            <p className="text-xs n-muted">Müfredat yükleniyor...</p>
          ) : !hasSteps ? (
            <p className="text-xs n-muted">Dersler müfredatında başlıklı alt konu bulunamadı.</p>
          ) : (
            <select
              aria-label="Bağlanacak ders alt konusu"
              className="neon-input text-sm"
              value={linkedStepId ?? ''}
              disabled={busy}
              onChange={(e) => apply(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">— Müfredat alt konusu seç —</option>
              {catalog.map((mod) =>
                mod.lessons
                  .filter((l) => l.steps.length > 0)
                  .map((lesson) => (
                    <optgroup key={`${mod.module_id}-${lesson.lesson_id}`}
                      label={`${mod.module_name} › ${lesson.title}`}>
                      {lesson.steps.map((step) => (
                        <option key={step.step_id} value={step.step_id}>{step.title}</option>
                      ))}
                    </optgroup>
                  )),
              )}
            </select>
          )}
          {editing && (
            <button type="button" onClick={() => setEditing(false)}
              className="px-2 py-1 rounded-md text-white/70 hover:bg-white/10 text-xs">
              Vazgeç
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface AutoMatchProps {
  /** Bağlar değişince ağacı tazele (section.linked_lesson_step_id güncellensin). */
  onReloadTree: () => Promise<void>;
}

export function LessonLinkAutoMatchPanel({ onReloadTree }: AutoMatchProps) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<LessonLinkAutoMatchReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    const r = await autoMatchLessonLinks();
    if (!r) {
      setErr('Otomatik eşleştirme başarısız oldu.');
      setBusy(false);
      return;
    }
    setReport(r);
    await onReloadTree();
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3 space-y-2">
      <p className="text-xs font-bold text-cyan-200 uppercase tracking-widest">Ödev Köprüsü — Otomatik Eşleştir</p>
      <p className="text-xs n-muted">
        Bağlanmamış Alt Konu&apos;ları, Düzey/Konu/Alt Konu başlıkları Dersler müfredatıyla
        birebir tutanları otomatik bağlar. Elle bağladıklarına dokunmaz.
      </p>
      <button type="button" onClick={run} disabled={busy}
        className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
        {busy ? 'Eşleştiriliyor...' : 'Otomatik Eşleştir'}
      </button>
      {err && <p className="text-rose-400 text-xs">{err}</p>}
      {report && (
        <div className="text-xs space-y-1.5 pt-1">
          <p className="text-emerald-300">
            {report.linked.length} yeni bağ kuruldu · {report.already_linked} zaten bağlıydı · toplam {report.total} alt konu
          </p>
          {report.unmatched.length > 0 && (
            <div>
              <p className="text-amber-300">Eşleşmeyen ({report.unmatched.length}) — elle seçmen gerek:</p>
              <ul className="list-disc list-inside n-muted">
                {report.unmatched.map((u) => (
                  <li key={u.section_id}>{u.duzey_title} › {u.konu_title} › {u.section_title}</li>
                ))}
              </ul>
            </div>
          )}
          {report.ambiguous.length > 0 && (
            <div>
              <p className="text-amber-300">Birden çok aday ({report.ambiguous.length}) — elle seçmen gerek:</p>
              <ul className="list-disc list-inside n-muted">
                {report.ambiguous.map((u) => (
                  <li key={u.section_id}>{u.duzey_title} › {u.konu_title} › {u.section_title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Alt Konu için bağ değişikliğini sunucuya yazar + sonucu döner. */
export async function persistLessonLink(sectionId: number, stepId: number | null): Promise<boolean> {
  return updateCustomTabSection(sectionId, { linked_lesson_step_id: stepId });
}
