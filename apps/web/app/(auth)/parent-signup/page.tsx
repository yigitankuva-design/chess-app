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
  email: z.string().email('Geçerli e-posta gir'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  name: z.string().min(2, 'İsim gerekli'),
  kvkk_consent: z.boolean().refine(v => v === true, 'KVKK onayı gerekli'),
});

type FormData = z.infer<typeof schema>;


export default function ParentSignupPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const { kvkk_consent, ...apiData } = data;
      void kvkk_consent; // frontend-only field
      const res = await apiClient.parentSignup(apiData);
      auth.login(res.access_token, res.role, res.user_id);
      router.push('/parent/dashboard');
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
      <h1 className="text-3xl font-bold mb-6">Veli Kayıt</h1>

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
        className="w-full bg-blue-600 text-white py-3 rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Kayıt...' : 'Hesap Aç'}
      </button>

      <p className="text-center text-sm opacity-75">
        Hesabın var mı? <Link href="/parent-login" className="underline">Giriş yap</Link>
      </p>
    </form>
  );
}
