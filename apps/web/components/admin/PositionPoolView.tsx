'use client';
import { useState } from 'react';
import { BoardEditor } from '@/components/BoardEditor';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import { parseFenInput, withTurn } from '@/lib/chess/fenInput';

export interface PoolPosition {
  id: string;
  fen: string;
  category?: string | null;
  code?: string;
  /** Konumun hangi oyuncular arasında oynandığı — yalnızca Kazanç Konumu'nda girilir. */
  owner?: string | null;
}

/** Bir yatay satırda kaç kod kartı durur (kullanıcı kararı: 1-12, 13-24, …). */
export const POOL_ROW_SIZE = 12;

interface Props {
  pool: PoolPosition[];
  /** Düzenlenen konumu günceller. Kod DEĞİŞMEZ — sporcunun bildiği numara sabittir. */
  onUpdatePosition: (id: string, next: PoolPosition) => void;
  onDeletePosition: (id: string) => void;
  /** Düzenleme ekranında "Konumun Sahibi" alanını gösterir (yalnızca Kazanç Konumunu Pratik Yap). */
  showOwnerField?: boolean;
}

function satirlaraBol<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Konum havuzu: dikdörtgen bir kart; açılınca konumlar dairesel kod kartları
 * halinde 12'lik satırlarda listelenir. Bir koda tıklanınca o konum düzenlemeye
 * açılır (tahta o konumla dolu gelir).
 *
 * Kodlar `lib/exerciseCodes.ts` ile üretilir — Süresiz Pratik sorularıyla AYNI
 * mantık, ikinci bir numaralandırma yazılmaz.
 */
export function PositionPoolView({
  pool, onUpdatePosition, onDeletePosition, showOwnerField = false,
}: Props) {
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [taslakFen, setTaslakFen] = useState('');
  const [taslakTurn, setTaslakTurn] = useState<'w' | 'b'>('w');
  const [taslakOwner, setTaslakOwner] = useState('');

  const kodlar = assignExerciseCodes(pool);

  function duzenlemeyiAc(p: PoolPosition) {
    const parsed = parseFenInput(p.fen);
    setDuzenlenen(p.id);
    setTaslakFen(p.fen);
    setTaslakTurn(parsed.ok ? parsed.turn : 'w');
    setTaslakOwner(p.owner ?? '');
  }

  function vazgec() {
    setDuzenlenen(null);
    setTaslakFen('');
    setTaslakOwner('');
  }

  function kaydet(p: PoolPosition, kod: string) {
    onUpdatePosition(p.id, {
      ...p,
      fen: withTurn(taslakFen, taslakTurn),
      // Kod düzenlemeyle DEĞİŞMEZ; kodsuz eski konumda gösterilen kod kalıcılaşır.
      code: p.code ?? kod,
      ...(showOwnerField ? { owner: taslakOwner.trim() || null } : {}),
    });
    vazgec();
  }

  const satirlar = satirlaraBol(pool.map((p, i) => ({ p, kod: kodlar[i] })), POOL_ROW_SIZE);

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => { setAcik((v) => !v); vazgec(); }}
        aria-expanded={acik}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/5 text-left transition-colors">
        <span className="text-sm font-bold n-text flex-1">Konum Havuzu</span>
        <span className="text-xs n-muted px-2 py-0.5 rounded-full border border-white/15">
          {pool.length}
        </span>
        <span className="text-xs n-muted">{acik ? '▴' : '▾'}</span>
      </button>

      {acik && pool.length === 0 && (
        <p className="text-sm n-muted">Henüz konum eklenmedi.</p>
      )}

      {acik && pool.length > 0 && (
        <div className="space-y-2">
          {satirlar.map((satir, i) => (
            <div key={i} data-testid="kod-satiri" className="flex flex-wrap gap-2">
              {satir.map(({ p, kod }) => {
                const secili = duzenlenen === p.id;
                return (
                  <button key={p.id} type="button"
                    aria-label={`Konum ${kod}`}
                    onClick={() => (secili ? vazgec() : duzenlemeyiAc(p))}
                    className="flex items-center justify-center rounded-full font-mono font-bold text-xs transition-colors"
                    style={{
                      width: 40, height: 40,
                      border: secili ? '2px solid rgb(34 211 238)' : '1px solid rgba(255,255,255,0.15)',
                      background: secili ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.03)',
                      color: secili ? 'rgb(165 243 252)' : undefined,
                    }}>
                    {kod}
                  </button>
                );
              })}
            </div>
          ))}

          {satirlar.flat().map(({ p, kod }) => (
            duzenlenen === p.id && (
              <div key={`edit-${p.id}`} className="space-y-3 pt-2 border-t border-white/10">
                <p className="text-xs n-muted">
                  <span className="font-mono font-bold">{kod}</span> numaralı konumu düzenliyorsun.
                </p>
                <BoardEditor
                  fen={taslakFen} turn={taslakTurn}
                  onChange={setTaslakFen} onTurnChange={setTaslakTurn}
                />
                {showOwnerField && (
                  <div className="space-y-1">
                    <label htmlFor={`pool-owner-edit-${p.id}`} className="text-xs n-muted">Konumun Sahibi</label>
                    <input
                      id={`pool-owner-edit-${p.id}`}
                      value={taslakOwner}
                      onChange={(e) => setTaslakOwner(e.target.value)}
                      placeholder="Konumun hangi oyuncular arasında oynandığını yaz"
                      className="neon-input text-sm"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => kaydet(p, kod)}
                    className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
                    Değişikliği Kaydet
                  </button>
                  <button type="button" onClick={vazgec}
                    className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
                    Vazgeç
                  </button>
                  <button type="button" onClick={() => { onDeletePosition(p.id); vazgec(); }}
                    className="px-4 py-2 rounded-lg text-rose-300 border border-rose-400/40 hover:bg-rose-500/10 text-sm transition-colors">
                    Sil
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
