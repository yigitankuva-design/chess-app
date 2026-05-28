const TOKEN_KEY = 'chess_app_token';
const FINGERPRINT_KEY = 'chess_app_device_fp';


export function saveToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}


export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}


export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
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
