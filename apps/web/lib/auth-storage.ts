const TOKEN_KEY = 'chess_app_token';
const FINGERPRINT_KEY = 'chess_app_device_fp';
const ATHLETE_NAME_KEY = 'bea_athlete_name';


/**
 * Token sessionStorage'da tutulur — sekmeye özeldir, sekmeler arası
 * paylaşılmaz. Aynı tarayıcıda bir sekmede öğretmen paneli, diğerinde
 * sporcu/veli oturumu açıkken localStorage paylaşımlı olduğu için biri
 * diğerinin token'ının üzerine yazıyor, kayıtlar sessizce 401 ile
 * başarısız oluyordu (Zafer Hoca'nın bildirdiği "bazı alanlar çalışmıyor").
 */
export function saveToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_KEY, token);
}


export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}


export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ATHLETE_NAME_KEY);
}


export function saveAthleteName(name: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ATHLETE_NAME_KEY, name);
}


export function getAthleteName(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ATHLETE_NAME_KEY);
}


export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return '';
  let fp = localStorage.getItem(FINGERPRINT_KEY);
  if (!fp) {
    const random = crypto.randomUUID();
    const ua = navigator.userAgent.slice(0, 50);
    fp = btoa(`${random}-${ua}`).slice(0, 64);
    localStorage.setItem(FINGERPRINT_KEY, fp);
  }
  return fp;
}


export function saveDeviceFingerprint(fp: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FINGERPRINT_KEY, fp);
}
