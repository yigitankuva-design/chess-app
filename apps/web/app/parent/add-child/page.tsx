'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getToken, getDeviceFingerprint } from '@/lib/auth-storage';
import { AvatarSelector } from '@/components/AvatarSelector';
import { DEFAULT_AVATAR_ID } from '@/lib/avatars';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const schema = z.object({
  display_name: z.string().min(1, 'İsim gerekli').max(80),
  age: z.string().min(1, 'Yaş gerekli'),
  pin: z.string().regex(/^\d{4}$/, 'PIN 4 rakam olmalı'),
});
type FormData = z.infer<typeof schema>;

export default function AddChildPage() {
  const router = useRouter();
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR_ID);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    const ageNum = parseInt(data.age, 10);
    if (isNaN(ageNum) || ageNum < 4 || ageNum > 18) {
      setError('Yaş 4-18 arası olmalı');
      return;
    }
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: data.display_name, age: ageNum, pin: data.pin, avatar }),
      });
      if (!res.ok) { setError('Çocuk eklenemedi.'); return; }
      // Trust this device so the child can log in here
      try {
        await fetch(`${API_BASE}/auth/device/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ device_fingerprint: getDeviceFingerprint(), name: 'Bu cihaz' }),
        });
      } catch { /* ignore */ }
      router.push('/parent/dashboard');
    } catch {
      setError('Bir hata oluştu.');
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Çocuk Ekle</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <input {...register('display_name')} placeholder="Çocuğun adı" className="w-full p-3 border rounded" />
          {errors.display_name && <p className="text-red-600 text-sm mt-1">{errors.display_name.message}</p>}
        </div>
        <div>
          <input {...register('age')} type="number" placeholder="Yaş" className="w-full p-3 border rounded" />
          {errors.age && <p className="text-red-600 text-sm mt-1">{errors.age.message}</p>}
        </div>
        <div>
          <input {...register('pin')} inputMode="numeric" maxLength={4} placeholder="4 haneli PIN" className="w-full p-3 border rounded" />
          {errors.pin && <p className="text-red-600 text-sm mt-1">{errors.pin.message}</p>}
          <p className="text-xs opacity-60 mt-1">Çocuk uygulamaya bu PIN ile girecek.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Avatar seç</label>
          <AvatarSelector value={avatar} onChange={setAvatar} />
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-3 rounded disabled:opacity-50">
          {isSubmitting ? 'Ekleniyor...' : 'Çocuğu Ekle'}
        </button>
      </form>
    </main>
  );
}
