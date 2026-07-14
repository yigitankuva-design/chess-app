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

export default function HomePage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const { register, handleSubmit, formState: { isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await apiClient.login(data);
      auth.login(res.access_token, res.role, res.user_id);
      router.push(res.role === 'teacher' ? '/admin' : '/parent/dashboard');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('E-posta veya şifre yanlış');
      } else {
        setError('Giriş başarısız');
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-6">
      <div className="text-center">
        <img src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" className="h-20 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold mb-1">Bozüyük Satranç Akademisi</h1>
        <p className="text-base text-gray-500">Akademik Gelişim Platformu</p>
        <hr className="my-5 border-gray-200" />
        <p className="text-lg font-semibold text-gray-700">Hoş Geldiniz</p>
        <hr className="my-5 border-gray-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-xs space-y-4">
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
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-blue-600 underline">
            Şifremi unuttum
          </Link>
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-lg font-bold shadow disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Giriş...' : 'Giriş Yap'}
        </button>
        <p className="text-center text-sm opacity-75">
          Hesabın yok mu? <Link href="/parent-signup" className="underline">Kayıt Ol</Link>
        </p>
      </form>
    </main>
  );
}
