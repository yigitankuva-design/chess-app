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
});

type FormData = z.infer<typeof schema>;

export default function TeacherSignupPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await apiClient.teacherSignup(data);
      auth.login(res.access_token, res.role, res.user_id);
      router.push('/classes');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('Bu e-posta zaten kayıtlı');
      } else {
        setError('Kayıt başarısız, tekrar dene');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🎓</div>
        <h1 className="text-3xl font-bold">Öğretmen Kaydı</h1>
        <p className="text-sm opacity-60 mt-1">Sınıfınızı oluşturun, öğrencilerinizi yönetin</p>
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

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-green-600 text-white py-3 rounded disabled:opacity-50 font-medium"
      >
        {isSubmitting ? 'Kaydediliyor...' : 'Öğretmen Hesabı Aç'}
      </button>

      <p className="text-center text-sm opacity-75">
        Zaten hesabın var mı? <Link href="/parent-login" className="underline">Giriş yap</Link>
      </p>
    </form>
  );
}
