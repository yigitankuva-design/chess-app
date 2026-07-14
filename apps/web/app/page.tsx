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
    <main className="neon-shell flex flex-col items-center justify-center p-8 gap-6">
      <div className="w-full max-w-xs neon-card neon-cyan p-7">
        <div className="text-center">
          <img src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" className="h-20 w-auto mx-auto mb-3 drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
          <h1 className="text-2xl font-bold mb-1 n-text">Bozüyük Satranç Akademisi</h1>
          <p className="text-sm n-muted">Akademik Gelişim Platformu</p>
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          <p className="text-lg font-semibold n-text">Hoş Geldiniz</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <input
            {...register('email')}
            type="email"
            placeholder="E-posta"
            className="neon-input"
          />
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Şifre"
              className="neon-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-cyan-300 transition-colors"
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
            <Link href="/forgot-password" className="text-sm text-cyan-400 hover:text-cyan-300">
              Şifremi unuttum
            </Link>
          </div>
          {error && <p className="text-rose-400 text-sm">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="neon-btn">
            {isSubmitting ? 'Giriş...' : 'Giriş Yap'}
          </button>
          <p className="text-center text-sm n-muted">
            Hesabın yok mu? <Link href="/parent-signup" className="text-cyan-400 hover:text-cyan-300">Kayıt Ol</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
