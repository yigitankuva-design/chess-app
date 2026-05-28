export interface AvatarOption {
  id: string;
  emoji: string;
  label: string;
}

export const AVATARS: AvatarOption[] = [
  { id: 'lion', emoji: '🦁', label: 'Aslan' },
  { id: 'fox', emoji: '🦊', label: 'Tilki' },
  { id: 'bear', emoji: '🐻', label: 'Ayı' },
  { id: 'owl', emoji: '🦉', label: 'Baykuş' },
  { id: 'tiger', emoji: '🐯', label: 'Kaplan' },
  { id: 'panda', emoji: '🐼', label: 'Panda' },
];

export const DEFAULT_AVATAR_ID = 'lion';

export function avatarEmoji(id: string | null | undefined): string {
  const found = AVATARS.find((a) => a.id === id);
  return found ? found.emoji : '🦁';
}

const AVATAR_KEY = 'chess_app_avatar';

export function getSavedAvatar(): string {
  if (typeof window === 'undefined') return DEFAULT_AVATAR_ID;
  return localStorage.getItem(AVATAR_KEY) || DEFAULT_AVATAR_ID;
}

export function saveAvatar(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AVATAR_KEY, id);
}
