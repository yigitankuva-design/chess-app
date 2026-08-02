/** "Tüm cevap karelerine tıkla" modunda tek bir tıklamanın sonucu (madde 2).
 *  React yok — saf mantık.
 *  - wrong: tıklanan kare hedeflerden biri değil (1 yanlış = soru yanlış).
 *  - partial: doğru kare ama daha tıklanacak hedef var (veya zaten tıklanmış).
 *  - complete: bu tıkla TÜM hedefler tamamlandı. */
export type ClickResult = 'wrong' | 'partial' | 'complete';

export function evaluateClick(
  square: string,
  targets: string[],
  alreadyClicked: string[],
): ClickResult {
  if (!targets.includes(square)) return 'wrong';
  const set = new Set(alreadyClicked);
  set.add(square);
  const allDone = targets.every((t) => set.has(t));
  return allDone ? 'complete' : 'partial';
}
