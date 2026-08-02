import { hasPieces } from '@/lib/admin/movePieceSteps';
import type { StepInfo } from '@/lib/admin/movePieceSteps';

/** Cumle/Goruntu akislarinin adim durumu. "Belirle" adimlari BILFIIL tiklama
 *  ister — varsayilan degerlere bakmak kilidi islevsiz birakir (P7 karari). */
export interface ChoiceStepState {
  instruction: string;
  promptImage: string;
  optionCountChosen: boolean;
  answerKindChosen: boolean;
  options: string[];
  answerKind: 'sentence' | 'image';
  difficultyChosen: boolean;
}

export interface ClickSquareStepState {
  instruction: string;
  setupFen: string;
  turnChosen: boolean;
  /** "Konumu Kaydet" sonrasi kilitlenen konum; null = henuz kaydedilmedi. */
  savedFen: string | null;
  targets: string[];
  /** Sporcu tıklama modu (any/all) bilfiil seçildi mi (madde 2). */
  clickModeChosen: boolean;
  difficultyChosen: boolean;
}

function withFinal(labels: string[], done: boolean[]): StepInfo[] {
  // "Soruyu Ekle" son satirdir: oncekilerin HEPSI bitince ✓.
  const all = [...done, done.every(Boolean)];
  return [...labels, 'Soruyu Ekle'].map((label, i) => ({ no: i + 1, label, done: all[i] }));
}

export function choiceSteps(
  s: ChoiceStepState,
  kind: 'sentence_question' | 'image_question',
): StepInfo[] {
  const answersDone = s.options.length >= 2 && s.options.every((o) => o.trim().length > 0);
  const base: [string, boolean][] = [
    ['Talimatı Gir', s.instruction.trim().length > 0],
    ['Seçenek Sayısını Belirle', s.optionCountChosen],
    ['Cevap Tipini Belirle', s.answerKindChosen],
    ['Cevapları Gir', answersDone],
    ['Zorluk Düzeyini Belirle', s.difficultyChosen],
  ];
  if (kind === 'image_question') {
    base.unshift(['Soru Görseli Seç', s.promptImage.length > 0]);
  }
  return withFinal(base.map(([l]) => l), base.map(([, d]) => d));
}

export function clickSquareSteps(s: ClickSquareStepState): StepInfo[] {
  // BOS TAHTA MESRUDUR: kare isimleri ogretilen sorularda tahta bos birakilir
  // ("e4'e tikla"). Bu yuzden Konum Diz, tas dizilince VEYA konum bilerek
  // kaydedilince tamam sayilir — bos tahta kilit sebebi degildir.
  const base: [string, boolean][] = [
    ['Talimatı Gir', s.instruction.trim().length > 0],
    ['Konum Diz', hasPieces(s.setupFen) || s.savedFen !== null],
    ['Hamle Sırasını Belirle', s.turnChosen],
    ['Konumu Kaydet', s.savedFen !== null],
    ['Doğru Kare(leri) Seç', s.targets.length > 0],
    ['Sporcu Tıklama Sayısını Belirle', s.clickModeChosen],
    ['Zorluk Düzeyini Belirle', s.difficultyChosen],
  ];
  return withFinal(base.map(([l]) => l), base.map(([, d]) => d));
}

export function firstIncomplete(steps: StepInfo[]): StepInfo | null {
  return steps.find((st) => !st.done) ?? null;
}

export function allDone(steps: StepInfo[]): boolean {
  return steps.every((st) => st.done);
}
