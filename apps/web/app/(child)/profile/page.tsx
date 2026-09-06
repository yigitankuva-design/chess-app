'use client';
import { ProfileView } from '@/components/profile/ProfileView';

/**
 * Madde 2026-09-07 (GRUP B): sayfa gövdesi components/profile/ProfileView.tsx'e
 * taşındı — antrenörün salt-okunur öğrenci görünümü (bkz.
 * app/(teacher)/students/[id]/page.tsx) AYNI bileşeni kullanıyor. Bu sayfa
 * artık sadece "kendi profilim" moduyla (childId YOK → kendi token'ı) çağırır.
 */
export default function ProfilePage() {
  return <ProfileView />;
}
