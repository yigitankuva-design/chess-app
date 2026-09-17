export interface LichessCloudEvalPv {
  cp: number | null;
  mate: number | null;
  movesUci: string[];
}

export interface LichessCloudEvalResult {
  depth: number;
  pvs: LichessCloudEvalPv[];
}

/**
 * Madde 2026-09-18 (Analiz Et — Lichess Cloud Eval): Lichess'in ücretsiz,
 * herkese açık "cloud eval" önbelleğini sorgular (`lichess.org/api/cloud/
 * eval` — resmi OpenAPI şemasından doğrulandı, `Access-Control-Allow-
 * Origin: *` başlığı taşıdığı için doğrudan tarayıcıdan çağrılabilir).
 * SADECE önceden hesaplanmış (çoğunlukla açılış) pozisyonlar için sonuç
 * döner, YENİ bir hesaplama YAPMAZ. Bulunamazsa (404) veya ağ/oran-sınırı
 * hatasında `null` döner — çağıran taraf yerel motora SESSİZCE düşer.
 *
 * `cp`/`mate` Lichess'te BEYAZ açısından döner — `scoreForWhite` ile
 * AYRICA dönüştürülmemeli (bkz. AnalysisBoard.tsx).
 */
export async function fetchLichessCloudEval(
  fen: string, multiPv: number,
): Promise<LichessCloudEvalResult | null> {
  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const body = await r.json();
    if (!Array.isArray(body?.pvs) || body.pvs.length === 0) return null;
    return {
      depth: body.depth,
      pvs: body.pvs.map((pv: { cp?: number; mate?: number; moves: string }) => ({
        cp: pv.cp ?? null,
        mate: pv.mate ?? null,
        movesUci: pv.moves.split(' '),
      })),
    };
  } catch {
    return null;
  }
}
