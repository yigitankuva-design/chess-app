import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Gizlilik Politikası</h1>
      <p className="text-sm text-gray-500 mb-8">Son güncelleme: Mayıs 2026</p>

      <section className="space-y-8 text-gray-800 dark:text-gray-200">
        <div>
          <h2 className="text-xl font-semibold mb-2">1. Veri Sorumlusu</h2>
          <p>Bu uygulama bir eğitim projesidir. İletişim: <a href="mailto:yigitankuva@gmail.com" className="text-blue-600 underline">yigitankuva@gmail.com</a></p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">2. Toplanan Kişisel Veriler</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li><strong>Veli/Öğretmen:</strong> E-posta adresi, ad-soyad, şifre (şifrelenmiş olarak saklanır)</li>
            <li><strong>Çocuk:</strong> Takma ad, yaş, avatar seçimi</li>
            <li><strong>Kullanım verileri:</strong> Tamamlanan dersler, çözülen bulmacalar, oyun sonuçları, günlük kullanım süresi</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">3. İşlenme Amacı</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Kullanıcı hesaplarının oluşturulması ve yönetimi</li>
            <li>Çocuğun eğitim ilerlemesinin takibi</li>
            <li>Veli bildirimlerinin gönderilmesi (haftalık özet e-postası)</li>
            <li>Uygulama güvenliğinin sağlanması</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">4. Verilerin Aktarılması</h2>
          <p>Kişisel verileriniz üçüncü taraflarla paylaşılmamaktadır. Veriler yalnızca ilgili çocuğun velisine ve atandığı sınıfın öğretmenine görünür kılınmaktadır.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">5. Veri Saklama Süresi</h2>
          <p>Verileriniz hesabınız aktif olduğu sürece saklanır. Hesabı sildiğinizde tüm veriler kalıcı olarak silinir.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">6. Haklarınız (KVKK Madde 11)</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
            <li>İşlenen verilere ilişkin bilgi talep etme</li>
            <li>Verilerin düzeltilmesini isteme</li>
            <li>Verilerin silinmesini isteme</li>
            <li>Veri işlemeye itiraz etme</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">7. Çocuğun Verileri</h2>
          <p>Çocuğa ait veriler yalnızca ebeveyn onayıyla toplanır. Ebeveyn, çocuk profilini Veli Paneli üzerinden silebilir.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">8. İletişim</h2>
          <p>KVKK kapsamındaki talepleriniz için: <a href="mailto:yigitankuva@gmail.com" className="text-blue-600 underline">yigitankuva@gmail.com</a></p>
        </div>
      </section>

      <div className="mt-12 border-t pt-6">
        <Link href="/" className="text-blue-600 underline">← Ana Sayfaya Dön</Link>
      </div>
    </main>
  );
}
