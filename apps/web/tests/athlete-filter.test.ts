import { describe, it, expect } from 'vitest';
import { trLower, filterAthletes, mergeOnline } from '@/lib/play/athleteFilter';
import type { AthleteRow } from '@/lib/play/athleteFilter';

const ROWS: AthleteRow[] = [
  { child_id: 1, display_name: 'Ayşe',   online: true },
  { child_id: 2, display_name: 'Ayhan',  online: false },
  { child_id: 3, display_name: 'Mehmet', online: true },
  { child_id: 4, display_name: 'Şeyma',  online: false },
  { child_id: 5, display_name: 'Işık',   online: false },
];

describe('trLower', () => {
  it('Türkçe büyük İ küçülünce i olur', () => {
    expect(trLower('İSTANBUL')).toBe('istanbul');
  });

  it('Türkçe büyük I küçülünce ı olur', () => {
    expect(trLower('IŞIK')).toBe('ışık');
  });
});

describe('filterAthletes', () => {
  it('boş sorgu tüm listeyi döndürür', () => {
    expect(filterAthletes(ROWS, '')).toHaveLength(5);
    expect(filterAthletes(ROWS, '   ')).toHaveLength(5);
  });

  it('harf harf daraltır', () => {
    // 'a' -> Ayşe, Ayhan ve Şeyma. "Mehmet"te a harfi YOK.
    expect(filterAthletes(ROWS, 'a').map((r) => r.display_name))
      .toEqual(['Ayşe', 'Ayhan', 'Şeyma']);
    expect(filterAthletes(ROWS, 'ay').map((r) => r.display_name))
      .toEqual(['Ayşe', 'Ayhan']);
    expect(filterAthletes(ROWS, 'ayh').map((r) => r.display_name))
      .toEqual(['Ayhan']);
  });

  it('TÜRKÇE: büyük harfle arama da tutar', () => {
    expect(filterAthletes(ROWS, 'ŞEY').map((r) => r.display_name)).toEqual(['Şeyma']);
    expect(filterAthletes(ROWS, 'IŞ').map((r) => r.display_name)).toEqual(['Işık']);
  });

  it('eşleşme yoksa boş döner', () => {
    expect(filterAthletes(ROWS, 'zzz')).toEqual([]);
  });
});

describe('mergeOnline', () => {
  it('aktifleri başa alır ve online bayrağını koyar', () => {
    const all = [
      { child_id: 1, display_name: 'Ayşe' },
      { child_id: 2, display_name: 'Ayhan' },
      { child_id: 3, display_name: 'Mehmet' },
    ];
    const merged = mergeOnline(all, [3]);
    expect(merged.map((r) => r.display_name)).toEqual(['Mehmet', 'Ayşe', 'Ayhan']);
    expect(merged[0].online).toBe(true);
    expect(merged[1].online).toBe(false);
  });

  it('kimse aktif değilse sıra korunur', () => {
    const all = [{ child_id: 1, display_name: 'Ayşe' }];
    expect(mergeOnline(all, [])).toEqual([
      { child_id: 1, display_name: 'Ayşe', online: false },
    ]);
  });
});
