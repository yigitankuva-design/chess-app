import { ANALYSIS_BOARD_MAX_WIDTH } from './AnalysisBoard';

const BackArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

interface Props {
  title: string;
  onBack: () => void;
}

/**
 * Analiz Et sayfaları (Yeni Analiz / Maçlarımın Analizi / Konum Analizi)
 * ORTAK başlık satırı — madde 2026-09-04 (1b/3b/4b): Geri butonu artık
 * EvalBar'la (bkz. AnalysisBoard.tsx) AYNI dikey hizada — ikisinin de
 * genişliği farklı olduğu için (36px vs 22px) Geri butonu -7px sola
 * kaydırılarak MERKEZLERİ eşitlendi. Çerçevesi EvalBar'la AYNI accent
 * renginde (belirginleştirildi), ok işareti SVG'ye çevrildi (kalın, daireye
 * simetrik — Unicode "←" karakterinin fontlara göre kaymasının önüne geçer).
 *
 * Madde (1a/3a/4a): başlık, tahtanın genişliğiyle (ANALYSIS_BOARD_MAX_WIDTH)
 * aynı genişlikte bir kutu içinde ortalanarak Geri butonunun hemen sağına
 * yerleştirilir — tahtanın ortasına doğru sağa kaymış görünür.
 */
export function AnalizPageHeader({ title, onBack }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onBack} aria-label="Geri"
        className="flex items-center justify-center rounded-full t-premium flex-shrink-0"
        style={{
          width: 36, height: 36, marginLeft: -7,
          border: '2px solid rgba(34,211,238,0.6)',
        }}>
        <BackArrowIcon />
      </button>
      <div className="flex-1 flex justify-center" style={{ maxWidth: ANALYSIS_BOARD_MAX_WIDTH }}>
        <h1 className="text-xl font-extrabold t-premium">{title}</h1>
      </div>
    </div>
  );
}
