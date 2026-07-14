import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <img src="/logo.jpeg" alt="Bozüyük Satranç Akademisi Logo" className="h-20 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold mb-1">Bozüyük Satranç Akademisi</h1>
        <p className="text-base text-gray-500">Akademik Gelişim Platformu</p>

        <hr className="my-5 border-gray-200" />

        <p className="text-lg font-semibold text-gray-700">Hoş Geldiniz</p>

        <hr className="my-5 border-gray-200" />
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/parent-login"
          className="block text-center bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-lg font-bold shadow transition-colors"
        >
          Giriş
        </Link>

        <Link
          href="/parent-signup"
          className="block text-center border-2 border-blue-600 text-blue-600 hover:bg-blue-50 py-4 rounded-2xl text-lg font-bold transition-colors"
        >
          Kayıt Ol
        </Link>
      </div>
    </main>
  );
}
