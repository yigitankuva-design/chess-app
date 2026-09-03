import { ANALYSIS_BOARD_MAX_WIDTH } from './AnalysisBoard';

interface Props {
  title: string;
}

/**
 * Analiz Et sayfaları (Yeni Analiz / Maçlarımın Analizi / Konum Analizi)
 * ORTAK başlık satırı — SADECE başlık. Madde 2026-09-04 (4): kendi "geri"
 * butonu KALDIRILDI — uygulamada geri gitme işlemi artık TEK yerden
 * (AppNav.tsx'in üst bar'ı) yapılıyor, bu sayfalarda AppNav zaten aynı işi
 * (aynı hedefe) yapıyordu; ikinci bir gösterge bırakılmadı.
 *
 * Başlık, tahtanın genişliğiyle (ANALYSIS_BOARD_MAX_WIDTH) aynı genişlikte
 * bir kutu içinde ortalanır.
 */
export function AnalizPageHeader({ title }: Props) {
  return (
    <div className="flex justify-center" style={{ maxWidth: ANALYSIS_BOARD_MAX_WIDTH, margin: '0 auto' }}>
      <h1 className="text-xl font-extrabold t-premium">{title}</h1>
    </div>
  );
}
