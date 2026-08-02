import { describe, it, expect } from 'vitest';
import { evaluateClick } from '@/lib/play/multiSquareCheck';

describe('evaluateClick — çoklu-kare doğrulama (madde 2, all modu)', () => {
  const targets = ['e4', 'e5', 'd4'];

  it('yanlış kareye tık → wrong', () => {
    expect(evaluateClick('a1', targets, [])).toBe('wrong');
  });

  it('doğru kare ama hepsi tamamlanmadı → partial', () => {
    expect(evaluateClick('e4', targets, [])).toBe('partial');
    expect(evaluateClick('e5', targets, ['e4'])).toBe('partial');
  });

  it('son doğru kare tıklanınca → complete', () => {
    expect(evaluateClick('d4', targets, ['e4', 'e5'])).toBe('complete');
  });

  it('zaten tıklanmış doğru kareye tekrar tık → partial (yanlış sayılmaz)', () => {
    expect(evaluateClick('e4', targets, ['e4'])).toBe('partial');
  });

  it('tek hedefli soruda ilk doğru tık → complete', () => {
    expect(evaluateClick('e4', ['e4'], [])).toBe('complete');
  });
});
