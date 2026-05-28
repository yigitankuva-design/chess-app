import { ReactNode } from 'react';

export default function ChildLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {children}
    </div>
  );
}
