'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function AthleteLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();

  const { register, handleSubmit, formState: { isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await apiClient.login(data);
      if (res.role !== 'athlete') {
        setError('Bu giriş yalnızca 14+ sporcular içindir');
        return;
      }
      auth.login(res.access_token, res.role as 'athlete', res.user_id);
      router.push('/athlete/dashboard');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('E-posta veya şifre yanlış');
      } else {
        setError('Giriş başarısız');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-2xl font-bold">Sporcu Girişi (14+)</h1>
        <p className="text-sm opacity-60 mt-1">14 yaş ve üzeri sporcular için bağımsız giriş</p>
      </div>

      <input
        {...register('email')}
        type="email"
        placeholder="E-posta"
        className="w-full p-3 border rounded"
      />

      <input
        {...register('password')}
        type="password"
        placeholder="Şifre"
        className="w-full p-3 border rounded"
      />

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded disabled:opacity-50 font-medium"
      >
        {isSubmitting ? 'Giriş...' : 'Giriş Yap'}
      </button>

      <p className="text-center text-sm opacity-75">
        Hesabın yok mu?{' '}
        <Link href="/athlete-signup" className="underline">Sporcu Kaydı (14+)</Link>
      </p>
      <p className="text-center text-sm">
        <Link href="/" className="underline opacity-50 text-xs">← Ana Sayfaya Dön</Link>
      </p>
    </form>
  );
}
