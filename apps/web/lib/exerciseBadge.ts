/** Admin badge grid tooltip metni — image_question'da instruction boş olabilir. */
export function exerciseBadgeTitle(ex: { type: string; instruction?: string }): string {
  if (ex.instruction) return ex.instruction;
  return ex.type === 'image_question' ? 'Görüntü sorusu' : '';
}
