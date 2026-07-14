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
        <img src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" className="h-16 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Kayıt Ol</h1>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Hesap türü</p>
        <div className="grid grid-cols-2 gap-2">
          <label className={`cursor-pointer border rounded-lg p-3 text-center text-sm font-medium transition-colors ${
            role === 'parent' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'
          }`}>
            <input type="radio" value="parent" {...register('role')} className="sr-only" />
            👤 Veli
          </label>
          <label className={`cursor-pointer border rounded-lg p-3 text-center text-sm font-medium transition-colors ${
            role === 'teacher' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'
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
          id="kvkk-consent"
          type="checkbox"
          {...register('kvkk_consent')}
          className="mt-1 h-4 w-4"
        />
        <label htmlFor="kvkk-consent" className="text-sm text-gray-600">
          <Link href="/privacy" target="_blank" className="text-blue-600 underline">Gizlilik Politikası</Link>&apos;nı ve{' '}
          <Link href="/terms" target="_blank" className="text-blue-600 underline">Kullanım Şartları</Link>&apos;nı okudum, kabul ediyorum. *
        </label>
      </div>
      {errors.kvkk_consent && <p className="text-red-600 text-sm">{errors.kvkk_consent.message}</p>}

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 rounded disabled:opacity-50 font-medium"
      >
        {isSubmitting ? 'Kayıt...' : 'Hesap Aç'}
      </button>

      <p className="text-center text-sm opacity-75">
        Hesabın var mı? <Link href="/parent-login" className="underline">Giriş yap</Link>
      </p>
    </form>
  );
}
