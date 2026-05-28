'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const schema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter'),
  email: z.string().email('Geçerli e-posta gir'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  age_confirm: z.boolean().refine(v => v === true, '14 yaşında veya büyük olduğunuzu onaylayın'),
  kvkk_consent: z.boolean().refine(v => v === true, 'Kullanım şartlarını kabul edin'),
});

type FormData = z.infer<typeof schema>;

export default function AthleteSignupPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/athlete/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) throw new ApiError(409, 'Bu e-posta zaten kayıtlı');
        throw new Error(body.detail || 'Kayıt başarısız');
      }
      const json = await res.json();
      auth.login(json.access_token, 'athlete', json.user_id);
      router.push('/athlete/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt başarısız');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-2xl font-bold">Sporcu Kaydı (14+)</h1>
        <p className="text-sm opacity-60 mt-1">14 yaş ve üzeri — veli onayı gerekmez</p>
      </div>

      <div>
        <input
          {...register('name')}
          placeholder="Adınız Soyadınız"
          className="w-full p-3 border rounded"
        />
        {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <input
          {...register('email')}
          type="email"
          placeholder="E-posta"
          className="w-full p-3 border rounded"
        />
        {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <input
          {...register('password')}
          type="password"
          placeholder="Şifre (en az 8 karakter)"
          className="w-full p-3 border rounded"
        />
        {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
      </div>

      <div className="flex items-start gap-2">
        <input
          id="age-confirm"
          type="checkbox"
          {...register('age_confirm')}
          className="mt-1 h-4 w-4"
        />
        <label htmlFor="age-confirm" className="text-sm text-gray-700">
          14 yaşında veya daha büyük olduğumu onaylıyorum. *
        </label>
      </div>
      {errors.age_confirm && (
        <p className="text-red-600 text-sm">{errors.age_confirm.message}</p>
      )}

      <div className="flex items-start gap-2">
        <input
          id="kvkk-consent"
          type="checkbox"
          {...register('kvkk_consent')}
          className="mt-1 h-4 w-4"
        />
        <label htmlFor="kvkk-consent" className="text-sm text-gray-600">
          <Link href="/privacy" target="_blank" className="text-emerald-700 underline">Gizlilik Politikası</Link>&apos;nı ve{' '}
          <Link href="/terms" target="_blank" className="text-emerald-700 underline">Kullanım Şartları</Link>&apos;nı okudum, kabul ediyorum. *
        </label>
      </div>
      {errors.kvkk_consent && (
        <p className="text-red-600 text-sm">{errors.kvkk_consent.message}</p>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded disabled:opacity-50 font-medium"
      >
        {isSubmitting ? 'Kayıt...' : 'Hesap Oluştur'}
      </button>

      <p className="text-center text-sm opacity-75">
        Zaten hesabın var mı?{' '}
        <Link href="/athlete-login" className="underline">Giriş Yap</Link>
      </p>
      <p className="text-center text-sm">
        <Link href="/" className="underline opacity-50 text-xs">← Ana Sayfaya Dön</Link>
      </p>
    </form>
  );
}
