'use client';
import { use } from 'react';
import { ProfileView } from '@/components/profile/ProfileView';

/**
 * Madde 2026-09-07 (GRUP B): Antrenör/Sınıflarım/Sınıf N'deki bir sporcunun
 * ismine tıklayınca açılan, GERÇEK Sporcu Profili sayfası — SALT OKUNUR
 * (bkz. components/profile/ProfileView.tsx, `childId` prop'u).
 */
export default function TeacherStudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProfileView childId={Number(id)} />;
}
