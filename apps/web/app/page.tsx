import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <img src="/logo.jpeg" alt="BEA Logo" className="h-20 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold mb-1">AKADEMİ GELİŞİM SİSTEMİ</h1>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">

        {/* Sporcu Girişi — 14 yaş altı (veli onaylı) */}
        <Link
          href="/child-login"
          className="block text-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-2xl font-bold shadow transition-colors"
        >
          🏅 Sporcu Girişi
          <span className="block text-xs font-normal opacity-80 mt-0.5">14 Yaş Altı · Veli Onaylı</span>
        </Link>

        {/* Sporcu Girişi — 14+ yaş (bağımsız) */}
        <Link
          href="/athlete-login"
          className="block text-center bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-bold shadow transition-colors"
        >
          🏆 Sporcu Girişi 14+
          <span className="block text-xs font-normal opacity-80 mt-0.5">14 Yaş ve Üzeri · Bağımsız Kayıt</span>
        </Link>

        <div className="relative flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">Yetişkin Girişi</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Parent */}
        <Link
          href="/parent-login"
          className="block text-center bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors"
        >
          👨‍👩‍👧 Veli Girişi
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
            href="/athlete-signup"
            className="flex-1 text-center border border-emerald-400 text-emerald-700 py-2 rounded-lg text-sm hover:bg-emerald-50 transition-colors"
          >
            Sporcu Kaydı (14+)
          </Link>
          <Link
            href="/parent-signup"
            className="flex-1 text-center border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:border-gray-400 transition-colors"
          >
            Veli Kaydı
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
