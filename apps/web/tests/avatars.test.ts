import { describe, it, expect, beforeEach } from 'vitest';
import { avatarEmoji, getSavedAvatar, saveAvatar, DEFAULT_AVATAR_ID, AVATARS } from '@/lib/avatars';

describe('avatars', () => {
  beforeEach(() => localStorage.clear());

  it('has 6 avatar options', () => {
    expect(AVATARS.length).toBe(6);
  });

  it('avatarEmoji returns emoji for known id', () => {
    expect(avatarEmoji('fox')).toBe('🦊');
  });

  it('avatarEmoji falls back for unknown id', () => {
    expect(avatarEmoji('nonexistent')).toBe('🦁');
  });

  it('save and get avatar roundtrip', () => {
    saveAvatar('bear');
    expect(getSavedAvatar()).toBe('bear');
  });

  it('getSavedAvatar defaults when none saved', () => {
    expect(getSavedAvatar()).toBe(DEFAULT_AVATAR_ID);
  });
});
