'use client';
import { ReactNode } from 'react';
import { AppNav } from '@/components/ui/AppNav';

export default function ChildLayout({ children }: { children: ReactNode }) {
  return (
    <div className="t-page min-h-screen">
      <AppNav />
      {children}
    </div>
  );
}
