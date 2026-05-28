export interface AvatarOption {
  id: string;
  emoji: string;
  label: string;
}

export const AVATARS: AvatarOption[] = [
  // Kız karakterler
  { id: 'girl',       emoji: '👧', label: 'Kız' },
  { id: 'girl_star',  emoji: '🧒‍♀️', label: 'Kahraman' },
  { id: 'princess',   emoji: '👸', label: 'Prenses' },
  // Erkek karakterler
  { id: 'boy',        emoji: '👦', label: 'Erkek' },
  { id: 'boy_cool',   emoji: '🧒', label: 'Çocuk' },
  { id: 'knight',     emoji: '🤴', label: 'Şövalye' },
  // Sporcular
  { id: 'athlete',    emoji: '⚽', label: 'Futbolcu' },
  { id: 'swimmer',    emoji: '🏊', label: 'Yüzücü' },
  { id: 'gymnast',    emoji: '🤸', label: 'Jimnastikçi' },
  // Fantastik
  { id: 'robot',      emoji: '🤖', label: 'Robot' },
  { id: 'unicorn',    emoji: '🦄', label: 'Unicorn' },
  { id: 'dragon',     emoji: '🐉', label: 'Ejderha' },
];

export const DEFAULT_AVATAR_ID = 'girl';

export function avatarEmoji(id: string | null | undefined): string {
  const found = AVATARS.find((a) => a.id === id);
  return found ? found.emoji : '👧';
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
