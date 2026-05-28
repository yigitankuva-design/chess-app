'use client';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppNav } from '@/components/ui/AppNav';

export default function AthleteLayout({ children }: { children: ReactNode }) {
  const { role, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) { router.push('/athlete-login'); }
    else if (role !== 'athlete') { router.push('/'); }
  }, [token, role, router]);

  if (!token || role !== 'athlete') return null;

  return (
    <div className="t-page min-h-screen">
      <AppNav />
      {children}
    </div>
  );
}
