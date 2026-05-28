'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Suspense } from 'react';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const isTeacher = searchParams.get('role') === 'teacher';

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
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{isTeacher ? '🎓' : '👤'}</div>
        <h1 className="text-2xl font-bold">
          {isTeacher ? 'Öğretmen Girişi' : 'Üye Girişi'}
        </h1>
        <p className="text-sm opacity-60 mt-1">
          {isTeacher
            ? 'Sınıflarınızı yönetmek için giriş yapın'
            : 'Hesabınıza giriş yapın'}
        </p>
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

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full text-white py-3 rounded disabled:opacity-50 font-medium ${
          isTeacher ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isSubmitting ? 'Giriş...' : 'Giriş Yap'}
      </button>

      <p className="text-center text-sm opacity-75">
        {isTeacher ? (
          <>Hesabın yok mu? <Link href="/teacher-signup" className="underline">Öğretmen kaydı</Link></>
        ) : (
          <>Hesabın yok mu? <Link href="/parent-signup" className="underline">Kayıt ol</Link></>
        )}
      </p>
      <p className="text-center text-sm opacity-75">
        {isTeacher ? (
          <Link href="/parent-login" className="underline opacity-60">← Veli girişine geç</Link>
        ) : (
          <Link href="/parent-login?role=teacher" className="underline opacity-60">Öğretmen girişi →</Link>
        )}
      </p>
    </form>
  );
}

export default function ParentLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
