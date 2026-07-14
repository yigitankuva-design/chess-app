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
  role: z.enum(['parent', 'teacher']),
  email: z.string().email('Geçerli e-posta gir'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  name: z.string().min(2, 'İsim gerekli'),
  kvkk_consent: z.boolean().refine(v => v === true, 'KVKK onayı gerekli'),
});

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { role: 'parent' } });

  const role = watch('role');

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const { kvkk_consent, role, ...apiData } = data;
      void kvkk_consent; // frontend-only field
      const res = role === 'teacher'
        ? await apiClient.teacherSignup(apiData)
        : await apiClient.parentSignup(apiData);
      auth.login(res.access_token, res.role, res.user_id);
      router.push(role === 'teacher' ? '/classes' : '/parent/dashboard');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('Bu e-posta zaten kayıtlı');
      } else {
        setError(e instanceof Error ? e.message : 'Kayıt başarısız');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-6">
        <img src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" className="h-16 w-auto mx-auto mb-3 drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
        <h1 className="text-2xl font-bold n-text">Kayıt Ol</h1>
      </div>

      <div>
        <p className="text-sm font-medium mb-2 n-muted">Hesap türü</p>
        <div className="grid grid-cols-2 gap-2">
          <label className={`cursor-pointer border rounded-lg p-3 text-center text-sm font-medium transition-colors ${
            role === 'parent' ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300 shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]' : 'border-white/10 text-gray-400 hover:border-white/25'
          }`}>
            <input type="radio" value="parent" {...register('role')} className="sr-only" />
            👤 Veli
          </label>
          <label className={`cursor-pointer border rounded-lg p-3 text-center text-sm font-medium transition-colors ${
            role === 'teacher' ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300 shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]' : 'border-white/10 text-gray-400 hover:border-white/25'
          }`}>
            <input type="radio" value="teacher" {...register('role')} className="sr-only" />
            🎓 Öğretmen
          </label>
        </div>
      </div>

      <div>
        <input
          {...register('name')}
          placeholder="Adınız"
          className="neon-input"
        />
        {errors.name && <p className="text-rose-400 text-sm mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <input
          {...register('email')}
          type="email"
          placeholder="E-posta"
          className="neon-input"
        />
        {errors.email && <p className="text-rose-400 text-sm mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <input
          {...register('password')}
          type="password"
          placeholder="Şifre (en az 8 karakter)"
          className="neon-input"
        />
        {errors.password && <p className="text-rose-400 text-sm mt-1">{errors.password.message}</p>}
      </div>

      <div className="flex items-start gap-2">
        <input
          id="kvkk-consent"
          type="checkbox"
          {...register('kvkk_consent')}
          className="mt-1 h-4 w-4 accent-cyan-400"
        />
        <label htmlFor="kvkk-consent" className="text-sm n-muted">
          <Link href="/privacy" target="_blank" className="text-cyan-400 hover:text-cyan-300 underline">Gizlilik Politikası</Link>&apos;nı ve{' '}
          <Link href="/terms" target="_blank" className="text-cyan-400 hover:text-cyan-300 underline">Kullanım Şartları</Link>&apos;nı okudum, kabul ediyorum. *
        </label>
      </div>
      {errors.kvkk_consent && <p className="text-rose-400 text-sm">{errors.kvkk_consent.message}</p>}

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      <button type="submit" disabled={isSubmitting} className="neon-btn">
        {isSubmitting ? 'Kayıt...' : 'Hesap Aç'}
      </button>

      <p className="text-center text-sm n-muted">
        Hesabın var mı? <Link href="/parent-login" className="text-cyan-400 hover:text-cyan-300">Giriş yap</Link>
      </p>
    </form>
  );
}
