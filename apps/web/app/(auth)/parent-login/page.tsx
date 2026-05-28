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


export default function ParentLoginPage() {
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
      router.push(res.role === 'teacher' ? '/classes' : '/parent/dashboard');
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
      <h1 className="text-3xl font-bold mb-4">Giriş Yap</h1>
      <p className="text-sm opacity-60 mb-6">Veli veya öğretmen hesabıyla giriş yapabilirsiniz</p>

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

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Giriş...' : 'Giriş Yap'}
      </button>

      <p className="text-center text-sm opacity-75">
        Veli hesabı yok mu? <Link href="/parent-signup" className="underline">Kayıt ol</Link>
      </p>
      <p className="text-center text-sm opacity-75">
        Öğretmen misiniz? <Link href="/teacher-signup" className="underline">Öğretmen hesabı aç</Link>
      </p>
    </form>
  );
}
