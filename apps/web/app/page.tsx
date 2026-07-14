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
  const [showPassword, setShowPassword] = useState(false);
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
        <div className="relative">
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="Şifre"
            className="w-full p-3 pr-12 border rounded"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
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
