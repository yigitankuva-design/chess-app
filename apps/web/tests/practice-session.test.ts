import { describe, it, expect, beforeEach } from 'vitest';
import { sessionKey, loadSession, saveSession, clearSession } from '@/lib/play/practiceSession';

interface Soru { id: number }

beforeEach(() => sessionStorage.clear());

describe('practiceSession — yenilemede aynı soruda kalma (madde 4/9)', () => {
  it('kayıt yoksa null döner', () => {
    expect(loadSession(sessionKey(1, 'suresiz'))).toBeNull();
  });

  it('kaydedilen set ve sıra geri okunur', () => {
    const key = sessionKey(7, 'suresiz');
    saveSession<Soru>(key, { items: [{ id: 1 }, { id: 2 }, { id: 3 }], index: 2 });
    expect(loadSession<Soru>(key)).toEqual({
      items: [{ id: 1 }, { id: 2 }, { id: 3 }], index: 2, currentAnswer: null, doneCount: 0,
    });
  });

  it('farklı adım/mod için kayıtlar karışmaz', () => {
    saveSession<Soru>(sessionKey(7, 'suresiz'), { items: [{ id: 1 }], index: 0 });
    expect(loadSession(sessionKey(7, 'sureli'))).toBeNull();
    expect(loadSession(sessionKey(8, 'suresiz'))).toBeNull();
  });

  it('TUZAK: sıra soru sayısını aşarsa sınıra çekilir, ekran kilitlenmez', () => {
    const key = sessionKey(7, 'test');
    sessionStorage.setItem(key, JSON.stringify({ items: [{ id: 1 }, { id: 2 }], index: 99 }));
    expect(loadSession<Soru>(key)!.index).toBe(1);
  });

  it('negatif sıra sıfıra çekilir', () => {
    const key = sessionKey(7, 'test');
    sessionStorage.setItem(key, JSON.stringify({ items: [{ id: 1 }], index: -5 }));
    expect(loadSession<Soru>(key)!.index).toBe(0);
  });

  it('bozuk kayıt çökmeye yol açmaz', () => {
    const key = sessionKey(7, 'test');
    sessionStorage.setItem(key, 'bu JSON değil');
    expect(loadSession(key)).toBeNull();
  });

  it('boş soru listesi geçersiz sayılır', () => {
    const key = sessionKey(7, 'test');
    sessionStorage.setItem(key, JSON.stringify({ items: [], index: 0 }));
    expect(loadSession(key)).toBeNull();
  });

  it('temizlenen oturum bir daha okunmaz', () => {
    const key = sessionKey(7, 'suresiz');
    saveSession<Soru>(key, { items: [{ id: 1 }], index: 0 });
    clearSession(key);
    expect(loadSession(key)).toBeNull();
  });
});

describe('practiceSession — cevap durumu kalıcılığı (madde 6)', () => {
  it('currentAnswer ve doneCount kaydedilip geri okunur', () => {
    const key = sessionKey(9, 'suresiz');
    saveSession<Soru>(key, {
      items: [{ id: 1 }, { id: 2 }], index: 1, currentAnswer: 'wrong', doneCount: 1,
    });
    expect(loadSession<Soru>(key)).toEqual({
      items: [{ id: 1 }, { id: 2 }], index: 1, currentAnswer: 'wrong', doneCount: 1,
    });
  });

  it('yeni alanlar verilmezse güvenli varsayılana düşer (eski kayıtlar bozulmaz)', () => {
    const key = sessionKey(9, 'sureli');
    sessionStorage.setItem(key, JSON.stringify({ items: [{ id: 1 }, { id: 2 }], index: 1 }));
    expect(loadSession<Soru>(key)).toEqual({
      items: [{ id: 1 }, { id: 2 }], index: 1, currentAnswer: null, doneCount: 0,
    });
  });

  it('geçersiz currentAnswer değeri null sayılır', () => {
    const key = sessionKey(9, 'test');
    sessionStorage.setItem(key, JSON.stringify({
      items: [{ id: 1 }], index: 0, currentAnswer: 'saçma', doneCount: 'x',
    }));
    expect(loadSession<Soru>(key)).toEqual({
      items: [{ id: 1 }], index: 0, currentAnswer: null, doneCount: 0,
    });
  });
});
