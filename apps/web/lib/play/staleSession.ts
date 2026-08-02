/** Kayıtlı bir pratik oturumunun GÜNCEL havuzla hâlâ uyuşup uyuşmadığını
 *  belirler (madde 4). Saf mantık — React yok, sessionStorage yok.
 *
 *  Neden gerekli: sporcu bir cihazda pratiğe başladığında havuzdaki soru
 *  sayısı kaydediliyor (ör. 4). Zafer Hoca sonradan havuza soru eklerse
 *  (ör. 20'ye çıkarsa), o cihazdaki eski kayıt SONSUZA KADAR aynı 4 soruyu
 *  gösterirdi — başka bir cihazda (kayıt yok) doğru 20 soru üretilirken.
 *  Bu "cihaz farkı" gibi görünen şey aslında bayat bir kayıttır.
 */
export function isSessionStale(
  savedItemCount: number,
  currentPoolSize: number,
  randomPick: number,
): boolean {
  const expected = randomPick > 0 ? Math.min(randomPick, currentPoolSize) : currentPoolSize;
  return savedItemCount !== expected;
}
