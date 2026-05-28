import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Kullanım Şartları</h1>
      <p className="text-sm text-gray-500 mb-8">Son güncelleme: Mayıs 2026</p>
      <section className="space-y-6 text-gray-800 dark:text-gray-200">
        <p>Bu uygulama, çocuklara satranç öğretmek amacıyla geliştirilmiş eğitim amaçlı bir platformdur.</p>
        <div>
          <h2 className="text-xl font-semibold mb-2">Kullanım Koşulları</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Uygulama yalnızca eğitim amaçlı kullanılabilir</li>
            <li>Çocuk hesapları yalnızca veli onayıyla oluşturulabilir</li>
            <li>Hakaret, küfür veya uygunsuz içerik paylaşımı yasaktır</li>
            <li>Hesap güvenliğinden kullanıcı sorumludur</li>
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Sorumluluk Reddi</h2>
          <p>Uygulama &quot;olduğu gibi&quot; sunulmaktadır. Eğitim içeriklerinin doğruluğu için azami özen gösterilmekle birlikte, garanti verilmemektedir.</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">İletişim</h2>
          <p>Sorularınız için: <a href="mailto:yigitankuva@gmail.com" className="text-blue-600 underline">yigitankuva@gmail.com</a></p>
        </div>
      </section>
      <div className="mt-12 border-t pt-6">
        <Link href="/" className="text-blue-600 underline">← Ana Sayfaya Dön</Link>
      </div>
    </main>
  );
}
