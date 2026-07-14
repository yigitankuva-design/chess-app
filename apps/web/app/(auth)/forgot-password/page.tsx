import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6 text-center">
      <div>
        <img src="/logo.jpeg" alt="Bozüyük Satranç Akademisi Logo" className="h-16 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Şifremi Unuttum</h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 text-left">
        <p className="mb-2">
          Şifre sıfırlama işlemi için lütfen akademi yöneticinizle iletişime geçin.
        </p>
        <p>
          Yöneticiniz hesabınızın şifresini sizin için yenileyebilir.
        </p>
      </div>

      <Link href="/parent-login" className="inline-block text-blue-600 underline text-sm">
        ← Giriş sayfasına dön
      </Link>
    </div>
  );
}
