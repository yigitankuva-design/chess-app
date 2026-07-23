import { describe, it, expect } from 'vitest';
import { assignExerciseCodes, nextExerciseCode } from '@/lib/exerciseCodes';

/**
 * REGRESYON: İlk sürümde, kayıtlı kodu olmayan sorular sadece kendi SIRA numarasından
 * ("idx+1") kod türetiyordu. Bir soru düzenlenip kalıcı bir kod kazandıktan sonra listeden
 * başka bir soru silinirse, kalan sıradaki bir sorunun sıra-tabanlı kodu, önceden kaydedilmiş
 * gerçek bir kodla ÇAKIŞABİLİYORDU (iki soru aynı anda "005" gösteriyordu — canlıda tespit
 * edildi). assignExerciseCodes artık kayıtlı kodları asla tekrar etmeyecek şekilde boşluk
 * doldurur. Bu dosya admin panelinde VE öğrenci ekranında (pratik/[mode], modules/[id])
 * kullanılan GERÇEK fonksiyonu test eder — yerel bir kopyasını değil.
 */
interface Ex { code?: string }

describe('assignExerciseCodes — sorulara çakışmasız kod atar', () => {
  it('boş listede ilk kod 001', () => {
    expect(nextExerciseCode([])).toBe('001');
  });

  it('kodsuz (eski) sorularda sıraya göre 3 haneli kod üretir', () => {
    expect(assignExerciseCodes<Ex>([{}, {}, {}])).toEqual(['001', '002', '003']);
  });

  it('kayıtlı kod varsa onu kullanır, sıradan türetmez', () => {
    expect(assignExerciseCodes<Ex>([{ code: '007' }])).toEqual(['007']);
  });

  it('bir soru silinse bile bir sonraki kod tekrar kullanılmaz', () => {
    const list: Ex[] = [{ code: '001' }, { code: '002' }, { code: '003' }, { code: '004' }];
    expect(nextExerciseCode(list)).toBe('005');
  });

  it('10dan fazla soru olsa da 3 haneli format korunur', () => {
    const list: Ex[] = Array.from({ length: 10 }, (_, i) => ({ code: String(i + 1).padStart(3, '0') }));
    expect(nextExerciseCode(list)).toBe('011');
  });

  it('REGRESYON: silme sonrası sıra-tabanlı kod, kayıtlı bir kodla çakışmaz', () => {
    const list: Ex[] = [{}, {}, { code: '005' }, {}, {}];
    const codes = assignExerciseCodes(list);
    expect(codes).toEqual(['001', '002', '005', '003', '004']);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('REGRESYON: yeni soru eklenirken görünen (henüz kaydedilmemiş) kodla da çakışmaz', () => {
    const list: Ex[] = [{}, {}, { code: '005' }, {}, {}];
    expect(nextExerciseCode(list)).toBe('006');
  });

  it('aynı liste iki kez hesaplansa bile aynı sonucu üretir (deterministik)', () => {
    // Öğrenci ekranında havuz karıştırılmadan önce kod atanmalı — bu yüzden aynı
    // orijinal sıradaki liste her seferinde AYNI kodları üretmeli.
    const list: Ex[] = [{}, {}, {}, { code: '099' }, {}];
    expect(assignExerciseCodes(list)).toEqual(assignExerciseCodes(list));
  });
});
