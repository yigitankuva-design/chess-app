import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">♟ Çocuklar İçin Satranç</h1>
        <p className="text-lg opacity-75">Oyna, öğren, ustalaş!</p>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link href="/child-login" className="block text-center bg-green-600 text-white py-4 rounded-2xl text-lg font-bold shadow">
          🎮 Çocuk Girişi
        </Link>
        <Link href="/parent-login" className="block text-center bg-blue-600 text-white py-3 rounded-xl font-medium">
          👨‍👩‍👧 Veli Girişi
        </Link>
        <Link href="/parent-signup" className="block text-center border border-blue-300 text-blue-700 py-3 rounded-xl">
          Yeni Veli Hesabı
        </Link>
      </div>
    </main>
  );
}
