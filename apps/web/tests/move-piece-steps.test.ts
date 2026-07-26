import { describe, it, expect } from 'vitest';
import {
  movePieceSteps, firstIncompleteStep, allStepsDone, hasPieces, formatNotation,
} from '@/lib/admin/movePieceSteps';
import type { MovePieceStepState } from '@/lib/admin/movePieceSteps';

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';
/** Siyahın oynadığı konum — formatNotation'ın "1..." dalını sınar. */
const BLACK_TURN = '6k1/8/5K2/8/5R2/8/8/8 b - - 0 1';

const BLANK: MovePieceStepState = {
  instruction: '',
  setupFen: EMPTY,
  turnChosen: false,
  moveFen: null,
  moves: [],
  notationSaved: false,
  difficultyChosen: false,
};

const FULL: MovePieceStepState = {
  instruction: 'Kaleyi h4e oyna',
  setupFen: TWO_SIDED,
  turnChosen: true,
  moveFen: TWO_SIDED,
  moves: ['Rh4'],
  notationSaved: true,
  difficultyChosen: true,
};

describe('hasPieces', () => {
  it('boş tahtada taş yoktur', () => {
    expect(hasPieces(EMPTY)).toBe(false);
  });

  it('taş varsa true döner', () => {
    expect(hasPieces(TWO_SIDED)).toBe(true);
  });

  it('sıra/rok alanları farklı olan boş tahtayı da boş sayar', () => {
    expect(hasPieces('8/8/8/8/8/8/8/8 b KQkq e3 5 12')).toBe(false);
  });
});

describe('movePieceSteps', () => {
  it('sekiz adım döner ve sıra numaraları 1-8 olur', () => {
    const steps = movePieceSteps(BLANK);
    expect(steps).toHaveLength(8);
    expect(steps.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('adım etiketleri kullanıcının istediği metinlerdir', () => {
    expect(movePieceSteps(BLANK).map((s) => s.label)).toEqual([
      'Talimatı Gir',
      'Konum Diz',
      'Hamle Sırasını Belirle',
      'Konumu Kaydet',
      'Cevap Hamlelerini Yap ve Notasyon Oluştur',
      'Notasyonu Kaydet',
      'Zorluk Düzeyini Belirle',
      'Soruyu Ekle',
    ]);
  });

  it('boş durumda hiçbir adım tamamlanmamıştır', () => {
    expect(movePieceSteps(BLANK).every((s) => !s.done)).toBe(true);
  });

  it('tam durumda sekiz adım da tamamlanmıştır (Soruyu Ekle dahil)', () => {
    expect(movePieceSteps(FULL).every((s) => s.done)).toBe(true);
  });

  it('adım 1 talimat girilince tamamlanır', () => {
    expect(movePieceSteps({ ...BLANK, instruction: 'Oyna' })[0].done).toBe(true);
  });

  it('adım 1 yalnızca boşluk girilirse tamamlanmaz', () => {
    expect(movePieceSteps({ ...BLANK, instruction: '   ' })[0].done).toBe(false);
  });

  it('TUZAK: adım 2 boş tahtada tamamlanmaz, taş dizilince tamamlanır', () => {
    expect(movePieceSteps(BLANK)[1].done).toBe(false);
    expect(movePieceSteps({ ...BLANK, setupFen: TWO_SIDED })[1].done).toBe(true);
  });

  it('TUZAK: adım 3 hamle sırası BİLFİİL seçilmeden tamamlanmaz', () => {
    expect(movePieceSteps(BLANK)[2].done).toBe(false);
    expect(movePieceSteps({ ...BLANK, turnChosen: true })[2].done).toBe(true);
  });

  it('adım 4 konum kaydedilince tamamlanır', () => {
    expect(movePieceSteps({ ...BLANK, moveFen: TWO_SIDED })[3].done).toBe(true);
  });

  it('adım 5 en az bir hamle varsa tamamlanır', () => {
    expect(movePieceSteps({ ...BLANK, moves: ['Rh4'] })[4].done).toBe(true);
  });

  it('adım 6 notasyon kaydedilince tamamlanır', () => {
    expect(movePieceSteps({ ...BLANK, notationSaved: true })[5].done).toBe(true);
  });

  it('TUZAK: adım 7 zorluk BİLFİİL seçilmeden tamamlanmaz', () => {
    expect(movePieceSteps(BLANK)[6].done).toBe(false);
    expect(movePieceSteps({ ...BLANK, difficultyChosen: true })[6].done).toBe(true);
  });

  it('Soruyu Ekle (8) yalnızca diğer yedisi bitince tamamlanır', () => {
    expect(movePieceSteps(FULL)[7].done).toBe(true);
    expect(movePieceSteps({ ...FULL, notationSaved: false })[7].done).toBe(false);
  });
});

describe('firstIncompleteStep / allStepsDone', () => {
  it('boş durumda ilk eksik adım 1. adımdır', () => {
    expect(firstIncompleteStep(BLANK)?.no).toBe(1);
  });

  it('yalnızca notasyon eksikse ilk eksik adım 6. adımdır', () => {
    expect(firstIncompleteStep({ ...FULL, notationSaved: false })?.no).toBe(6);
  });

  it('tam durumda eksik adım yoktur', () => {
    expect(firstIncompleteStep(FULL)).toBeNull();
  });

  it('allStepsDone yalnızca hepsi tamamsa true döner', () => {
    expect(allStepsDone(BLANK)).toBe(false);
    expect(allStepsDone(FULL)).toBe(true);
    expect(allStepsDone({ ...FULL, difficultyChosen: false })).toBe(false);
  });
});

describe('formatNotation', () => {
  it('hamle yoksa boş metin döner', () => {
    expect(formatNotation(TWO_SIDED, [])).toBe('');
  });

  it('tek hamleyi numaralandırır', () => {
    expect(formatNotation(TWO_SIDED, ['Rh4'])).toBe('1. Rh4');
  });

  it('beyaz-siyah çiftini tek satırda birleştirir', () => {
    expect(formatNotation(TWO_SIDED, ['Rh4', 'Kf8'])).toBe('1. Rh4 Kf8');
  });

  it('tek sayıda hamlede son siyah hücresi boş bırakılır', () => {
    expect(formatNotation(TWO_SIDED, ['Rh4', 'Kf8', 'Rh8'])).toBe('1. Rh4 Kf8 2. Rh8');
  });

  it('siyahın başladığı konumda "1..." biçimi kullanılır', () => {
    expect(formatNotation(BLACK_TURN, ['Kf8'])).toBe('1... Kf8');
  });

  it('siyah başlayıp devam ederse numaralandırma kaymaz', () => {
    expect(formatNotation(BLACK_TURN, ['Kf8', 'Rh4'])).toBe('1... Kf8 2. Rh4');
  });
});
