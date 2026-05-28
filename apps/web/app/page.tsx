import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <div className="text-5xl mb-3">♟️</div>
        <h1 className="text-3xl font-bold mb-2">Çocuklar İçin Satranç</h1>
        <p className="opacity-60">Oyna, öğren, ustalaş!</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Child */}
        <Link
          href="/child-login"
          className="block text-center bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl text-lg font-bold shadow transition-colors"
        >
          🎮 Çocuk Girişi
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
