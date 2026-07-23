import { describe, it, expect } from 'vitest';

/**
 * assignCodes/nextCode mantığı admin sayfasında (page.tsx) tanımlı, export edilmiyor —
 * burada aynı mantığı izole test ediyoruz.
 *
 * REGRESYON: İlk sürümde, kayıtlı kodu olmayan sorular sadece kendi SIRA numarasından
 * ("idx+1") kod türetiyordu. Bir soru düzenlenip kalıcı bir kod kazandıktan sonra listeden
 * başka bir soru silinirse, kalan sıradaki bir sorunun sıra-tabanlı kodu, önceden kaydedilmiş
 * gerçek bir kodla ÇAKIŞABİLİYORDU (iki soru aynı anda "005" gösteriyordu — canlıda tespit
 * edildi). assignCodes artık kayıtlı kodları asla tekrar etmeyecek şekilde boşluk doldurur.
 */
interface Ex { code?: string }

function assignCodes(list: Ex[]): string[] {
  const used = new Set(list.map((e) => e.code).filter((c): c is string => !!c));
  const out: string[] = [];
  let next = 1;
  for (const ex of list) {
    if (ex.code) { out.push(ex.code); continue; }
    let c = String(next).padStart(3, '0');
    while (used.has(c)) { next++; c = String(next).padStart(3, '0'); }
    used.add(c);
    out.push(c);
    next++;
  }
  return out;
}

function nextCode(list: Ex[]): string {
  const nums = assignCodes(list).map((c) => parseInt(c, 10)).filter((n) => !isNaN(n));
  return String(Math.max(0, ...nums) + 1).padStart(3, '0');
}

describe('assignCodes — sorulara çakışmasız kod atar', () => {
  it('boş listede ilk kod 001', () => {
    expect(nextCode([])).toBe('001');
  });

  it('kodsuz (eski) sorularda sıraya göre 3 haneli kod üretir', () => {
    expect(assignCodes([{}, {}, {}])).toEqual(['001', '002', '003']);
  });

  it('kayıtlı kod varsa onu kullanır, sıradan türetmez', () => {
    expect(assignCodes([{ code: '007' }])).toEqual(['007']);
  });

  it('bir soru silinse bile bir sonraki kod tekrar kullanılmaz', () => {
    const list: Ex[] = [{ code: '001' }, { code: '002' }, { code: '003' }, { code: '004' }];
    expect(nextCode(list)).toBe('005');
  });

  it('10dan fazla soru olsa da 3 haneli format korunur', () => {
    const list: Ex[] = Array.from({ length: 10 }, (_, i) => ({ code: String(i + 1).padStart(3, '0') }));
    expect(nextCode(list)).toBe('011');
  });

  it('REGRESYON: silme sonrası sıra-tabanlı kod, kayıtlı bir kodla çakışmaz', () => {
    // Sıra: [kodsuz, kodsuz, kodsuz, "005" kayıtlı, kodsuz, ...] — 3. soru silindi diyelim,
    // "005" kayıtlı soru artık 4. sırada. Sıra-tabanlı naif hesap ona da "004" derdi (çakışma yok)
    // ama BİR SONRAKİ kodsuz soru sırada "005" konumuna düşer — kayıtlı "005" ile çakışmamalı.
    const list: Ex[] = [{}, {}, { code: '005' }, {}, {}];
    const codes = assignCodes(list);
    expect(codes).toEqual(['001', '002', '005', '003', '004']);
    expect(new Set(codes).size).toBe(codes.length); // hiçbiri tekrar etmiyor
  });

  it('REGRESYON: yeni soru eklenirken görünen (henüz kaydedilmemiş) kodla da çakışmaz', () => {
    // "005" kayıtlı, diğerleri kodsuz — ekranda 001,002,005(gerçek),003,004 görünüyor.
    // Yeni eklenecek soru en büyüğün üstüne (006) çıkmalı, "003"/"004" gibi zaten
    // görünen bir sıra-tabanlı koda denk gelmemeli.
    const list: Ex[] = [{}, {}, { code: '005' }, {}, {}];
    expect(nextCode(list)).toBe('006');
  });
});
