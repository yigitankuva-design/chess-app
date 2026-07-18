'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';
import { DEFAULT_SETTINGS, mergeSettings, AppSettingsData } from '@/lib/settings/defaults';
import { getPieceSet, getBoardColors, PIECE_KEYS } from '@/lib/chess/boardSkin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const MAX_PIECE_BYTES = 64 * 1024;

const PIECE_LABELS: Record<string, string> = {
  wK: 'Beyaz Şah', wQ: 'Beyaz Vezir', wR: 'Beyaz Kale', wB: 'Beyaz Fil', wN: 'Beyaz At', wP: 'Beyaz Piyon',
  bK: 'Siyah Şah', bQ: 'Siyah Vezir', bR: 'Siyah Kale', bB: 'Siyah Fil', bN: 'Siyah At', bP: 'Siyah Piyon',
};

// Önizleme için başlangıç dizilişi (üstten alta: rank 8 → 1)
const START_ROWS: (string | null)[][] = [
  ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
  ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
  ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'],
];

export default function AdminBoardPage() {
  const { reload } = useSettings();
  const [board, setBoard] = useState<AppSettingsData['board']>(DEFAULT_SETTINGS.board);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { setBoard(mergeSettings(d).board); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function save(next: AppSettingsData['board']) {
    setSaving(true); setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ board: next }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setMsg(typeof d.detail === 'string' ? d.detail : 'Kaydedilemedi');
      return;
    }
    setMsg('Kaydedildi ✓'); reload();
  }

  function onPieceFile(key: string, file: File | undefined) {
    if (!file) return;
    if (!/\.(png|svg)$/i.test(file.name) && !/(png|svg)/i.test(file.type)) {
      setMsg('Sadece PNG veya SVG'); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const uri = String(reader.result);
      if (new Blob([uri]).size > MAX_PIECE_BYTES) {
        setMsg(`${PIECE_LABELS[key]} çok büyük (≤64KB). Daha küçük görsel seç.`); return;
      }
      setBoard((b) => ({ ...b, pieces: { ...b.pieces, [key]: uri } }));
      setMsg(null);
    };
    reader.readAsDataURL(file);
  }

  function resetPiece(key: string) {
    setBoard((b) => {
      const next = { ...b.pieces };
      delete next[key];
      return { ...b, pieces: next };
    });
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const colors = getBoardColors(board);
  const pieceSet = getPieceSet(board.pieces);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1 n-text">Görünüm — Tahta & Taş</h1>
      <p className="text-sm n-muted mb-6">Renk ve taş değişiklikleri kaydedince tüm sporcu tahtalarına yansır.</p>
      {msg && <p className="text-sm text-cyan-300 mb-4">{msg}</p>}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Sol: ayarlar */}
        <div className="space-y-4">
          <div className="neon-card neon-cyan p-5">
            <h2 className="font-bold mb-3 n-text">Kare Renkleri</h2>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-24 text-xs n-muted">Açık kare</span>
              <input type="color" value={colors.light}
                onChange={(e) => setBoard({ ...board, lightSquare: e.target.value })}
                className="h-9 w-16 rounded bg-transparent cursor-pointer" />
              <span className="text-xs n-muted">{colors.light}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-xs n-muted">Koyu kare</span>
              <input type="color" value={colors.dark}
                onChange={(e) => setBoard({ ...board, darkSquare: e.target.value })}
                className="h-9 w-16 rounded bg-transparent cursor-pointer" />
              <span className="text-xs n-muted">{colors.dark}</span>
            </div>
          </div>

          <div className="neon-card neon-purple p-5">
            <h2 className="font-bold mb-1 n-text">Taş Görselleri</h2>
            <p className="text-xs n-muted mb-3">Her taş için PNG/SVG yükle (≤64KB). Boş bırakırsan varsayılan taş kullanılır.</p>
            <div className="grid grid-cols-2 gap-2">
              {PIECE_KEYS.map((k) => {
                const uri = board.pieces[k];
                return (
                  <div key={k} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/10">
                    <span className="w-8 h-8 shrink-0 rounded" style={{ backgroundColor: colors.light }}>
                      {uri ? <img src={uri} alt={k} className="w-full h-full object-contain" /> : null}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.7rem] n-muted truncate">{PIECE_LABELS[k]}</p>
                      <label className="text-[0.7rem] text-cyan-300 cursor-pointer hover:underline">
                        Yükle
                        <input type="file" accept="image/png,image/svg+xml" className="hidden"
                          onChange={(e) => onPieceFile(k, e.target.files?.[0])} />
                      </label>
                      {uri && (
                        <button onClick={() => resetPiece(k)} className="ml-2 text-[0.7rem] text-rose-400 hover:underline">
                          Sıfırla
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sağ: canlı önizleme */}
        <div>
          <div className="neon-card neon-green p-5 sticky top-4">
            <h2 className="font-bold mb-3 n-text">Önizleme</h2>
            <div className="rounded-2xl p-3 mx-auto" style={{ maxWidth: 320, backgroundColor: '#ffffff' }}>
              <div className="grid grid-cols-8 rounded-lg overflow-hidden">
                {START_ROWS.map((row, ri) =>
                  row.map((piece, ci) => {
                    const isLight = (ri + ci) % 2 === 0;
                    const Icon = piece ? pieceSet[piece as keyof typeof pieceSet] : null;
                    return (
                      <div key={`${ri}-${ci}`} className="aspect-square flex items-center justify-center"
                        style={{ backgroundColor: isLight ? colors.light : colors.dark }}>
                        {Icon ? <div className="w-full h-full"><Icon /></div> : null}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-6">
        <button onClick={() => save(board)} disabled={saving}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 text-sm transition-colors">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button onClick={() => { setBoard(DEFAULT_SETTINGS.board); save(DEFAULT_SETTINGS.board); }}
          className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
          Varsayılana dön
        </button>
      </div>
    </div>
  );
}
