'use client';
import { useState } from 'react';
import { BoardEditor } from '@/components/BoardEditor';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import { parseFenInput, withTurn } from '@/lib/chess/fenInput';
import { CandidateMoveAnalysisPanel, type CandidateMoveResult } from './CandidateMoveAnalysisPanel';

/** Kaydedilmiş/backend ile aynı biçim (snake_case — bkz. apps/api PracticePosition.
 *  candidate_moves). `CandidateMoveAnalysisPanel`'in ürettiği camelCase
 *  `CandidateMoveResult` SADECE analiz anında geçicidir — havuza girerken
 *  buraya (toStoredCandidate ile) çevrilir. */
export interface CandidateMove {
  move_uci: string;
  move_san: string;
  score_cp: number | null;
  mate: number | null;
}

export function toStoredCandidate(c: CandidateMoveResult): CandidateMove {
  return { move_uci: c.moveUci, move_san: c.moveSan, score_cp: c.scoreCp, mate: c.mate };
}

export interface PoolPosition {
  id: string;
  fen: string;
  code?: string;
  /** Cevap anahtarı — motorun bulduğu en fazla 3 aday hamle. */
  candidate_moves?: CandidateMove[] | null;
}

export const POOL_ROW_SIZE = 12;

interface Props {
  pool: PoolPosition[];
  onUpdatePosition: (id: string, next: PoolPosition) => void;
  onDeletePosition: (id: string) => void;
}

function satirlaraBol<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Aday Hamle Pratiği'nin konum havuzu — `PositionPoolView`'in forku (madde
 * 2026-09-15). Tek fark: her pozisyonun kendi cevap anahtarı (3 aday hamle)
 * vardır. Admin bir konumu düzenlerken pozisyonu DEĞİŞTİRİRSE, eski cevap
 * anahtarı pozisyonla eşleşmez hale gelir — bu yüzden "Değişikliği Kaydet"
 * yalnızca kayıtlı hamleler GÜNCEL pozisyona aitse (ya da admin yeniden
 * "Analiz Et"e basıp taze bir sonuç üretmişse) açılır. Bu kısıtlama ortak
 * `PositionPoolView`'a eklenseydi diğer 3 havuzu (Kazanç/Oyunsonu/genel)
 * gereksiz yere karmaşıklaştırırdı — bu yüzden ayrı bir bileşen.
 */
export function CandidateMovePoolView({ pool, onUpdatePosition, onDeletePosition }: Props) {
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [taslakFen, setTaslakFen] = useState('');
  const [taslakTurn, setTaslakTurn] = useState<'w' | 'b'>('w');
  const [taslakCandidates, setTaslakCandidates] = useState<CandidateMove[] | null>(null);
  /** `taslakCandidates`in HANGİ pozisyon için üretildiği — güncel pozisyonla
   *  eşleşmiyorsa kayıtlı hamleler geçersiz sayılır (bkz. yukarıdaki not). */
  const [taslakCandidatesFen, setTaslakCandidatesFen] = useState<string | null>(null);

  const kodlar = assignExerciseCodes(pool);

  function duzenlemeyiAc(p: PoolPosition) {
    const parsed = parseFenInput(p.fen);
    setDuzenlenen(p.id);
    setTaslakFen(p.fen);
    setTaslakTurn(parsed.ok ? parsed.turn : 'w');
    const existing = p.candidate_moves && p.candidate_moves.length > 0 ? p.candidate_moves : null;
    setTaslakCandidates(existing);
    setTaslakCandidatesFen(existing ? p.fen : null);
  }

  function vazgec() {
    setDuzenlenen(null);
    setTaslakFen('');
    setTaslakCandidates(null);
    setTaslakCandidatesFen(null);
  }

  const guncelFen = () => withTurn(taslakFen, taslakTurn);
  const hamlelerGuncel = taslakCandidates !== null && taslakCandidatesFen === guncelFen();

  function kaydet(p: PoolPosition, kod: string) {
    if (!hamlelerGuncel || !taslakCandidates) return;
    onUpdatePosition(p.id, {
      ...p,
      fen: guncelFen(),
      code: p.code ?? kod,
      candidate_moves: taslakCandidates,
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
                {taslakCandidates && (
                  <div className="text-xs n-muted space-y-0.5">
                    <p className="font-semibold">
                      {hamlelerGuncel ? 'Kayıtlı cevap anahtarı:' : 'Eski cevap anahtarı (pozisyon değişti — geçersiz):'}
                    </p>
                    {taslakCandidates.map((c, i) => (
                      <p key={c.move_uci}>{i + 1}. <b>{c.move_san}</b></p>
                    ))}
                  </div>
                )}
                {!hamlelerGuncel && (
                  <CandidateMoveAnalysisPanel
                    fen={guncelFen()}
                    onAnalyzed={(cands) => {
                      setTaslakCandidates(cands.map(toStoredCandidate));
                      setTaslakCandidatesFen(guncelFen());
                    }}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => kaydet(p, kod)} disabled={!hamlelerGuncel}
                    className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
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
