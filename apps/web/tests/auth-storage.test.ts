import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveToken, getToken, clearAuth,
  getDeviceFingerprint,
} from '@/lib/auth-storage';

describe('auth-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('token sessionStorage\'da saklanır — sekmeler arası çakışmaz (rol karışma hatası)', () => {
    saveToken('jwt-token-abc');
    expect(sessionStorage.getItem('chess_app_token')).toBe('jwt-token-abc');
    expect(localStorage.getItem('chess_app_token')).toBeNull();
  });

  it('saves and reads token', () => {
    saveToken('jwt-token-abc');
    expect(getToken()).toBe('jwt-token-abc');
  });

  it('clears auth removes token', () => {
    saveToken('jwt-token-abc');
    clearAuth();
    expect(getToken()).toBeNull();
  });

  it('returns null when no token saved', () => {
    expect(getToken()).toBeNull();
  });

  it('generates and persists device fingerprint', () => {
    const fp1 = getDeviceFingerprint();
    const fp2 = getDeviceFingerprint();
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(20);
  });
});
