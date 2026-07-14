'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParentLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return <p className="text-center">Yönlendiriliyor...</p>;
}
