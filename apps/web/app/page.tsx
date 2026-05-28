import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <img src="/logo.jpeg" alt="BEA Logo" className="h-20 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold mb-1">AKADEMİ GELİŞİM SİSTEMİ</h1>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">

        {/* Üye Girişi */}
        <Link
          href="/parent-login"
          className="block text-center bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-lg font-bold shadow transition-colors"
        >
          👤 Üye Girişi
        </Link>

        {/* Teacher */}
        <Link
          href="/parent-login?role=teacher"
          className="block text-center bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-medium transition-colors"
        >
          🎓 Öğretmen Girişi
        </Link>

        <div className="flex gap-2 pt-1">
          <Link
            href="/parent-signup"
            className="flex-1 text-center border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:border-gray-400 transition-colors"
          >
            Üye Kaydı
          </Link>
          <Link
            href="/teacher-signup"
            className="flex-1 text-center border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:border-gray-400 transition-colors"
          >
            Öğretmen Kaydı
          </Link>
        </div>
      </div>
    </main>
  );
}
