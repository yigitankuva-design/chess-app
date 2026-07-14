import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6 text-center">
      <div>
        <img src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" className="h-16 w-auto mx-auto mb-3 drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
        <h1 className="text-2xl font-bold n-text">Şifremi Unuttum</h1>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm n-muted text-left">
        <p className="mb-2">
          Şifre sıfırlama işlemi için lütfen akademi yöneticinizle iletişime geçin.
        </p>
        <p>
          Yöneticiniz hesabınızın şifresini sizin için yenileyebilir.
        </p>
      </div>

      <Link href="/parent-login" className="inline-block text-cyan-400 hover:text-cyan-300 text-sm">
        ← Giriş sayfasına dön
      </Link>
    </div>
  );
}
