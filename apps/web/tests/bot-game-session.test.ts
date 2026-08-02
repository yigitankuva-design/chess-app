import { describe, it, expect, beforeEach } from 'vitest';
import {
  botGameKey, loadBotGame, saveBotGame, clearBotGame,
} from '@/lib/play/botGameSession';

beforeEach(() => sessionStorage.clear());

const SAMPLE = {
  gameId: 42,
  moves: ['e2e4', 'e7e5'],
  whiteTime: 297,
  blackTime: 299,
  drawOffersUsed: 1,
};

describe('botGameSession — anahtar', () => {
  it('seviye/renk/başlangıç konumu farklıysa anahtar da farklıdır', () => {
    expect(botGameKey(3, 'w')).not.toBe(botGameKey(5, 'w'));
    expect(botGameKey(3, 'w')).not.toBe(botGameKey(3, 'b'));
    expect(botGameKey(3, 'w')).not.toBe(botGameKey(3, 'w', '8/8/8/8/8/8/8/8 w - - 0 1'));
  });

  it('aynı girdiler aynı anahtarı üretir', () => {
    expect(botGameKey(3, 'w')).toBe(botGameKey(3, 'w'));
  });
});

describe('botGameSession — kaydet/oku/temizle', () => {
  it('kayıt yoksa null döner', () => {
    expect(loadBotGame(botGameKey(1, 'w'))).toBeNull();
  });

  it('kaydedilen oyun aynen geri okunur', () => {
    const key = botGameKey(1, 'w');
    saveBotGame(key, SAMPLE);
    expect(loadBotGame(key)).toEqual(SAMPLE);
  });

  it('temizlenen oyun bir daha okunmaz', () => {
    const key = botGameKey(1, 'w');
    saveBotGame(key, SAMPLE);
    clearBotGame(key);
    expect(loadBotGame(key)).toBeNull();
  });

  it('farklı seviyedeki kayıtlar birbirine karışmaz', () => {
    saveBotGame(botGameKey(1, 'w'), SAMPLE);
    expect(loadBotGame(botGameKey(2, 'w'))).toBeNull();
  });
});

describe('botGameSession — bozuk kayıtlar ekranı kilitlemez', () => {
  it('JSON olmayan kayıt null döner', () => {
    const key = botGameKey(1, 'w');
    sessionStorage.setItem(key, 'bu JSON değil');
    expect(loadBotGame(key)).toBeNull();
  });

  it('moves dizi değilse kayıt geçersiz sayılır', () => {
    const key = botGameKey(1, 'w');
    sessionStorage.setItem(key, JSON.stringify({ ...SAMPLE, moves: 'e2e4' }));
    expect(loadBotGame(key)).toBeNull();
  });

  it('eksik sayısal alanlar güvenli varsayılana düşer', () => {
    const key = botGameKey(1, 'w');
    sessionStorage.setItem(key, JSON.stringify({ moves: ['e2e4'] }));
    expect(loadBotGame(key)).toEqual({
      gameId: null, moves: ['e2e4'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
    });
  });

  it('hamlesi olmayan kayıt geçersizdir (yeni oyun açılsın)', () => {
    const key = botGameKey(1, 'w');
    sessionStorage.setItem(key, JSON.stringify({ ...SAMPLE, moves: [] }));
    expect(loadBotGame(key)).toBeNull();
  });
});
