import { describe, it, expect } from 'vitest';
import {
  playerState, expectedStudentMove, tryStudentMove,
  opponentKeyMove, isSequenceComplete, appendUciMove,
} from '@/lib/chess/movePlayer';

const KINGLESS = '8/8/8/8/8/8/4P3/8 w - - 0 1';       // öğretim pozisyonu
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';   // gerçek prod pozisyonu
const CASTLING = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
const EN_PASSANT = '8/8/8/3pP3/8/8/8/8 w - d6 0 2';
const PROMOTION = 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1';

describe('playerState', () => {
  it('ŞAHSIZ pozisyonda çökmez (skipValidation kanıtı)', () => {
    const s = playerState(KINGLESS, []);
    expect(s.turn).toBe('w');
    expect(s.isStudentTurn).toBe(true);
  });

  it('hamlelerden sonraki güncel pozisyonu döner', () => {
    expect(playerState(TWO_SIDED, ['Rh4']).fen).toContain('7R');
  });

  it('tek hamleden sonra sıra rakibe geçer', () => {
    expect(playerState(TWO_SIDED, ['Rh4']).isStudentTurn).toBe(false);
  });

  it('iki hamleden sonra sıra tekrar sporcuda', () => {
    expect(playerState(TWO_SIDED, ['Rh4', 'Kf8']).isStudentTurn).toBe(true);
  });
});

describe('expectedStudentMove', () => {
  it('çift indekste sporcunun hamlesini döner', () => {
    expect(expectedStudentMove(['Rh4', 'Kf8', 'Rh8#'], [])).toBe('Rh4');
    expect(expectedStudentMove(['Rh4', 'Kf8', 'Rh8#'], ['Rh4', 'Kf8'])).toBe('Rh8#');
  });

  it('rakip sırasındayken null döner', () => {
    expect(expectedStudentMove(['Rh4', 'Kf8'], ['Rh4'])).toBeNull();
  });

  it('anahtar bittiyse null döner', () => {
    expect(expectedStudentMove(['Rh4'], ['Rh4', 'Kf8'])).toBeNull();
  });
});

describe('tryStudentMove', () => {
  it('doğru hamle correct döner ve diziye eklenir', () => {
    const r = tryStudentMove(TWO_SIDED, ['Rh4', 'Kf8'], [], 'f4', 'h4');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['Rh4'] });
  });

  it('legal ama anahtardan farklı hamle wrong döner', () => {
    const r = tryStudentMove(TWO_SIDED, ['Rh4'], [], 'f4', 'f5');
    expect(r.kind).toBe('wrong');
  });

  it('kural dışı hamle illegal döner (ceza değil, geçersiz hareket)', () => {
    const r = tryStudentMove(TWO_SIDED, ['Rh4'], [], 'f4', 'e5');
    expect(r).toEqual({ kind: 'illegal' });
  });

  it('ŞAHSIZ pozisyonda doğru hamle çalışır', () => {
    const r = tryStudentMove(KINGLESS, ['e4'], [], 'e2', 'e4');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['e4'] });
  });

  it('ROK hamlesi SAN olarak doğru eşleşir', () => {
    const r = tryStudentMove(CASTLING, ['O-O'], [], 'e1', 'g1');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['O-O'] });
  });

  it('GEÇERKEN ALMA hamlesi SAN olarak doğru eşleşir', () => {
    const r = tryStudentMove(EN_PASSANT, ['exd6'], [], 'e5', 'd6');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['exd6'] });
  });

  it('TERFİ hamlesi vezire yapılır ve SAN eşleşir (şah eki dahil)', () => {
    // Ölçüldü: chess.js bu pozisyonda 'e8=Q+' üretiyor (şah eki SAN'ın parçası).
    const r = tryStudentMove(PROMOTION, ['e8=Q+'], [], 'e7', 'e8');
    expect(r.kind).toBe('correct');
  });

  it('MAT eki (#) olan hamle doğru eşleşir', () => {
    // Ölçüldü: 6k1/... pozisyonunda Rh4, Kf8 sonrası h4->h8 SAN'ı 'Rh8#' (mat).
    const r = tryStudentMove(TWO_SIDED, ['Rh4', 'Kf8', 'Rh8#'], ['Rh4', 'Kf8'], 'h4', 'h8');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['Rh4', 'Kf8', 'Rh8#'] });
  });

  it('ŞAH/MAT EKİ EKSİK anahtar eşleşmez (kanonik SAN zorunlu)', () => {
    // Anahtar 'Rh8' (eksik #) ise sporcunun 'Rh8#' hamlesi eşleşmez.
    // Pratikte sorun değil: P4'teki MoveRecorderBoard anahtarı chess.js'in
    // move.san'ından ürettiği için her zaman kanonik formda kaydediyor.
    const r = tryStudentMove(TWO_SIDED, ['Rh4', 'Kf8', 'Rh8'], ['Rh4', 'Kf8'], 'h4', 'h8');
    expect(r.kind).toBe('wrong');
  });
});

describe('opponentKeyMove', () => {
  it('rakip sırasında anahtarda hamle varsa onu döner', () => {
    expect(opponentKeyMove(['Rh4', 'Kf8'], ['Rh4'])).toBe('Kf8');
  });

  it('rakip sırasında anahtarda hamle yoksa null döner (motor sinyali)', () => {
    expect(opponentKeyMove(['Rh4'], ['Rh4'])).toBeNull();
  });

  it('sporcu sırasındayken null döner', () => {
    expect(opponentKeyMove(['Rh4', 'Kf8'], [])).toBeNull();
  });
});

describe('isSequenceComplete', () => {
  it('hiç hamle oynanmadıysa tamamlanmamıştır', () => {
    expect(isSequenceComplete(['Rh4'], [])).toBe(false);
  });

  it('rakip sırasındayken tamamlanmamıştır', () => {
    expect(isSequenceComplete(['Rh4'], ['Rh4'])).toBe(false);
  });

  it('sporcunun başka hamlesi kalmadıysa tamamlanmıştır', () => {
    expect(isSequenceComplete(['Rh4', 'Kf8'], ['Rh4', 'Kf8'])).toBe(true);
  });

  it('3 hamlelik anahtarda motor cevabından sonra tamamlanır', () => {
    expect(isSequenceComplete(['Rh4', 'Kf8', 'Rh8#'], ['Rh4', 'Kf8', 'Rh8#'])).toBe(false);
    expect(isSequenceComplete(['Rh4', 'Kf8', 'Rh8#'], ['Rh4', 'Kf8', 'Rh8#', 'Kg7'])).toBe(true);
  });
});

describe('studentParity (madde 2026-09-02 devam: b) Teori Pratiği — sporcu SİYAH oynayabilir)', () => {
  // 6k1/8/5K2/8/5R2/8/8/8 w — TWO_SIDED, beyaz başlar. Bu grupta sporcu
  // SİYAH kabul edilir (studentParity=1): rakip (beyaz) ilk hamleyi
  // (index 0) oynar, sporcu index 1'den başlar.
  it('playerState: parity=1 iken hiç hamle oynanmadan sıra rakipte sayılır', () => {
    const s = playerState(TWO_SIDED, [], 1);
    expect(s.isStudentTurn).toBe(false);
  });

  it('playerState: parity=1 iken TEK hamleden sonra sıra sporcuya geçer', () => {
    expect(playerState(TWO_SIDED, ['Rh4'], 1).isStudentTurn).toBe(true);
  });

  it('expectedStudentMove: parity=1 iken index 0 rakibindir, index 1 sporcunundur', () => {
    expect(expectedStudentMove(['Rh4', 'Kf8', 'Rh8#'], [], 1)).toBeNull();
    expect(expectedStudentMove(['Rh4', 'Kf8', 'Rh8#'], ['Rh4'], 1)).toBe('Kf8');
  });

  it('opponentKeyMove: parity=1 iken index 0 rakibindir', () => {
    expect(opponentKeyMove(['Rh4', 'Kf8'], [], 1)).toBe('Rh4');
    expect(opponentKeyMove(['Rh4', 'Kf8'], ['Rh4'], 1)).toBeNull();
  });

  it('tryStudentMove: parity=1 iken sporcunun hamlesi index 1 anahtarıyla karşılaştırılır', () => {
    // Rh4 zaten (rakip tarafından) oynanmış — şimdi sporcu (siyah) Kf8 oynuyor.
    const r = tryStudentMove(TWO_SIDED, ['Rh4', 'Kf8'], ['Rh4'], 'g8', 'f8', 1);
    expect(r).toEqual({ kind: 'correct', playedMoves: ['Rh4', 'Kf8'] });
  });

  it('varsayılan parity=0 davranışı DEĞİŞMEDİ (geriye dönük uyumluluk)', () => {
    expect(playerState(TWO_SIDED, []).isStudentTurn).toBe(true);
    expect(expectedStudentMove(['Rh4'], [])).toBe('Rh4');
    expect(opponentKeyMove(['Rh4', 'Kf8'], ['Rh4'])).toBe('Kf8');
    expect(isSequenceComplete(['Rh4', 'Kf8'], ['Rh4', 'Kf8'])).toBe(true);
  });
});

describe('appendUciMove', () => {
  it('motorun UCI cevabını SAN olarak ekler', () => {
    expect(appendUciMove(TWO_SIDED, ['Rh4'], 'g8f8')).toEqual(['Rh4', 'Kf8']);
  });

  it('"(none)" cevabında null döner (motorun hamlesi yok)', () => {
    expect(appendUciMove(TWO_SIDED, ['Rh4'], '(none)')).toBeNull();
  });

  it('boş cevapta null döner', () => {
    expect(appendUciMove(TWO_SIDED, ['Rh4'], '')).toBeNull();
  });

  it('kural dışı UCI cevabında null döner', () => {
    expect(appendUciMove(TWO_SIDED, ['Rh4'], 'a1a8')).toBeNull();
  });
});
