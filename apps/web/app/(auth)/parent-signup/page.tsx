'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { saveAthleteName, saveTeacherName } from '@/lib/auth-storage';

/**
 * Madde 2026-09-09 (Üyelik Girişi Yenileme): Zafer'in gönderdiği görsel
 * referansa göre "Kayıt Ol" formu tamamen yeniden tasarlandı. Hesap türü
 * hâlâ Üye/Antrenör — ama "Üye" artık VELİNİN değil SPORCUNUN kendi
 * bilgilerini toplar (İsim/Soyisim/Telefon/E-posta/Şehir/Lichess/
 * Kullanıcı Adı/Şifre) + Anne/Baba iletişim bilgileri.
 *
 * Doğum Tarihi'nden hesaplanan yaş kaydın NASIL işleneceğini belirler
 * (bkz. POST /auth/member/signup, backend'de dallanır):
 *  - 18+: sporcu KENDİ hesabını açar (role=athlete), admin onaylayana
 *    kadar giriş yapamaz (Tier A — yaş beyanı riskine karşı).
 *  - 18 altı: buradaki e-posta/kullanıcı adı/şifre VELİNİN giriş bilgisi
 *    olur (role=parent), sporcu bilgileri ChildProfile'a yazılır — eski
 *    "veli hesap açar, sporcu adını yazar" akışıyla AYNI sonuç, sadece
 *    artık il/telefon/anne-baba bilgisiyle daha zengin.
 *
 * İsim/Soyisim iki ayrı kutu ama TEK alanda birleştirilerek kaydedilir
 * (Zafer'in kararı — DB'de first_name/last_name ayrımı YOK). Anne/Baba
 * blokları da AYNI desen: en az biri (tüm alanlarıyla) dolu olmalı,
 * diğeri isteğe bağlı kalır.
 */
const schema = z.object({
  accountType: z.enum(['member', 'teacher']),
  first_name: z.string().min(2, 'İsim gerekli'),
  last_name: z.string().min(1, 'Soyisim gerekli'),
  phone: z.string().min(6, 'Telefon gerekli'),
  email: z.string().email('Geçerli e-posta gir'),
  province: z.string().min(2, 'Şehir gerekli'),
  lichess_username: z.string().optional(),
  username: z.string().min(3, 'Kullanıcı adı gerekli'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  birth_date: z.string().optional(),
  mother_first_name: z.string().optional(),
  mother_last_name: z.string().optional(),
  mother_phone: z.string().optional(),
  mother_email: z.string().optional(),
  father_first_name: z.string().optional(),
  father_last_name: z.string().optional(),
  father_phone: z.string().optional(),
  father_email: z.string().optional(),
  kvkk_consent: z.boolean().refine((v) => v === true, 'KVKK onayı gerekli'),
}).superRefine((val, ctx) => {
  if (val.accountType !== 'member') return;
  if (!val.birth_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['birth_date'], message: 'Doğum tarihi gerekli' });
  }
  const anneDolu = !!(val.mother_first_name && val.mother_last_name && val.mother_phone && val.mother_email);
  const babaDolu = !!(val.father_first_name && val.father_last_name && val.father_phone && val.father_email);
  if (!anneDolu && !babaDolu) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['mother_first_name'],
      message: 'Anne veya Baba bilgilerinden en az biri (İsim, Soyisim, Telefon, E-posta) tam doldurulmalı',
    });
  }
});

type FormData = z.infer<typeof schema>;

/** Görselde yıldızsız TEK alan — geri kalan her şey zorunlu (Zafer'in kuralı). */
const REQUIRED_MARK = <span className="text-rose-400">*</span>;

/**
 * Zafer'in isteği (2026-09-09): Şehir alanına hem elle yazılabilsin hem de
 * fare ile 81 il arasından seçilebilsin — native <input list> + <datalist>
 * ikisini birden sağlıyor (yazarken filtrelenen bir öneri listesi açılır,
 * ayrıca listeden tıklanabilir), ekstra bir kütüphane/bileşen gerekmiyor.
 */
const TURKIYE_ILLERI = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara',
  'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman',
  'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne',
  'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun',
  'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir',
  'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri',
  'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya',
  'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun',
  'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat',
  'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7a13.8 13.8 0 0 1-3.4 4.2M6.6 6.6C3.6 8.4 1.5 12 1.5 12s3.5 7 10.5 7a10.4 10.4 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { accountType: 'member' } });

  const accountType = watch('accountType');

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      if (data.accountType === 'teacher') {
        const res = await apiClient.teacherRegister({
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          phone: data.phone.trim(),
          email: data.email,
          province: data.province.trim(),
          lichess_username: data.lichess_username?.trim() || undefined,
          username: data.username.trim(),
          password: data.password,
          kvkk_consent: data.kvkk_consent,
        });
        // Madde 2026-09-09 (devam 4): antrenör başvurusu admin onaylayana
        // kadar giriş YAPAMAZ — çocuklarla doğrudan çalışacak rol olduğu
        // için Tier A onayı sporcudan antrenöre taşındı.
        if (res.approval_status === 'pending') {
          setPendingApproval(true);
          return;
        }
        auth.login(res.access_token, res.role, res.user_id);
        saveTeacherName(res.name);
        router.push('/coach');
        return;
      }

      // Madde 2026-09-09 (devam): İsim/Soyisim çiftleri TEK alana birleşir
      // (backend'de first_name/last_name ayrımı YOK — Zafer'in kararı).
      const motherName = data.mother_first_name && data.mother_last_name
        ? `${data.mother_first_name.trim()} ${data.mother_last_name.trim()}`.trim()
        : undefined;
      const fatherName = data.father_first_name && data.father_last_name
        ? `${data.father_first_name.trim()} ${data.father_last_name.trim()}`.trim()
        : undefined;

      const res = await apiClient.memberSignup({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        phone: data.phone.trim(),
        email: data.email,
        province: data.province.trim(),
        lichess_username: data.lichess_username?.trim() || undefined,
        username: data.username.trim(),
        password: data.password,
        birth_date: data.birth_date!,
        mother_name: motherName,
        mother_phone: data.mother_phone?.trim() || undefined,
        mother_email: data.mother_email?.trim() || undefined,
        father_name: fatherName,
        father_phone: data.father_phone?.trim() || undefined,
        father_email: data.father_email?.trim() || undefined,
        kvkk_consent: data.kvkk_consent,
      });

      // Madde 2026-09-09 (devam 5): sporcu tarafı ARTIK admin onayı
      // beklemiyor (Tier A antrenöre taşındı) — 18+ de 18 altı da HEMEN
      // giriş yapar. Backend HER İKİ yolda da (18+ dahil) bir ChildProfile
      // oluşturuyor (bkz. auth.py member_signup) — bu yüzden akış artık
      // TEK: rol ne olursa olsun (athlete VEYA parent) AYNI athlete/session
      // zincirlemesiyle /home'a gidilir — Zafer'in kararı: "18+ sporcu da
      // aynı paneli kullanamaz mı?" (ayrı bir /dashboard sayfası YOK artık).
      auth.login(res.access_token, res.role, res.user_id);
      const ath = await apiClient.athleteSession();
      auth.login(ath.access_token, 'child', ath.child_profile_id);
      saveAthleteName(ath.display_name);
      router.push('/home');
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Kayıt başarısız');
      }
    }
  };

  if (pendingApproval) {
    return (
      <div className="text-center space-y-4">
        <Image src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" width={640} height={640}
          className="h-16 w-auto mx-auto mb-3 drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
        <h1 className="text-2xl font-bold n-text">Hesabın Oluşturuldu</h1>
        <p className="n-muted text-sm">
          Antrenör başvurun akademi yönetimi tarafından incelenecek.
          Onaylandıktan sonra giriş yapabilirsin.
        </p>
        <Link href="/parent-login" className="text-cyan-400 hover:text-cyan-300 text-sm">Giriş sayfasına dön</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-6">
        <Image src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" width={640} height={640}
          className="h-16 w-auto mx-auto mb-3 drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
        <h1 className="text-2xl font-bold n-text">Kayıt Ol</h1>
      </div>

      <div>
        <p className="text-sm font-medium mb-2 n-muted">Hesap türü</p>
        <div className="grid grid-cols-2 gap-2">
          <label className={`cursor-pointer border rounded-lg p-3 text-center text-sm font-medium transition-colors ${
            accountType === 'member' ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300 shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]' : 'border-white/10 text-gray-400 hover:border-white/25'
          }`}>
            <input type="radio" value="member" {...register('accountType')} className="sr-only" />
            👤 Üye
          </label>
          <label className={`cursor-pointer border rounded-lg p-3 text-center text-sm font-medium transition-colors ${
            accountType === 'teacher' ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300 shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]' : 'border-white/10 text-gray-400 hover:border-white/25'
          }`}>
            <input type="radio" value="teacher" {...register('accountType')} className="sr-only" />
            🎓 Antrenör
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold n-text border-b border-white/10 pb-1">
          Üyelik Bilgileri {accountType === 'member' ? '(Sporcu)' : '(Antrenör)'}
        </p>

        {accountType === 'member' && (
          <div>
            <label htmlFor="birth_date" className="text-xs n-muted">Doğum Tarihi {REQUIRED_MARK}</label>
            <input id="birth_date" {...register('birth_date')} type="date" className="neon-input" />
            {errors.birth_date && <p className="text-rose-400 text-sm mt-1">{errors.birth_date.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <input {...register('first_name')} placeholder="İsim *" className="neon-input" />
            {errors.first_name && <p className="text-rose-400 text-sm mt-1">{errors.first_name.message}</p>}
          </div>
          <div>
            <input {...register('last_name')} placeholder="Soyisim *" className="neon-input" />
            {errors.last_name && <p className="text-rose-400 text-sm mt-1">{errors.last_name.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <input {...register('phone')} placeholder="Telefon *" className="neon-input" />
            {errors.phone && <p className="text-rose-400 text-sm mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <input {...register('email')} type="email" placeholder="E-posta *" className="neon-input" />
            {errors.email && <p className="text-rose-400 text-sm mt-1">{errors.email.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <input {...register('province')} list="il-listesi" placeholder="Şehir *" className="neon-input" />
            {errors.province && <p className="text-rose-400 text-sm mt-1">{errors.province.message}</p>}
          </div>
          <div>
            <input {...register('lichess_username')} placeholder="Lichess Kullanıcı Adı" className="neon-input" />
          </div>
        </div>
        {/* Zafer'in isteği: il elle yazılabilir VEYA bu listeden fareyle
            seçilebilir — <datalist> input'un altına açılan native öneri
            listesi olarak çalışır. */}
        <datalist id="il-listesi">
          {TURKIYE_ILLERI.map((il) => <option key={il} value={il} />)}
        </datalist>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <input {...register('username')} placeholder="Kullanıcı Adı *" className="neon-input" />
            {errors.username && <p className="text-rose-400 text-sm mt-1">{errors.username.message}</p>}
          </div>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Şifre (en az 8 karakter) *"
              className="neon-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-300"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            {errors.password && <p className="text-rose-400 text-sm mt-1">{errors.password.message}</p>}
          </div>
        </div>
      </div>

      {accountType === 'member' && (
        <>
          <div className="space-y-3">
            <p className="text-sm font-semibold n-text border-b border-white/10 pb-1">Veli bilgileri (Anne)</p>
            <div className="grid grid-cols-2 gap-2">
              <input {...register('mother_first_name')} placeholder="İsim" className="neon-input" />
              <input {...register('mother_last_name')} placeholder="Soyisim" className="neon-input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input {...register('mother_phone')} placeholder="Telefon" className="neon-input" />
              <input {...register('mother_email')} type="email" placeholder="E-posta" className="neon-input" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold n-text border-b border-white/10 pb-1">Veli bilgileri (Baba)</p>
            <div className="grid grid-cols-2 gap-2">
              <input {...register('father_first_name')} placeholder="İsim" className="neon-input" />
              <input {...register('father_last_name')} placeholder="Soyisim" className="neon-input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input {...register('father_phone')} placeholder="Telefon" className="neon-input" />
              <input {...register('father_email')} type="email" placeholder="E-posta" className="neon-input" />
            </div>
          </div>

          {errors.mother_first_name && (
            <p className="text-rose-400 text-sm">{errors.mother_first_name.message}</p>
          )}
        </>
      )}

      <div className="flex items-start gap-2">
        <input
          id="kvkk-consent"
          type="checkbox"
          {...register('kvkk_consent')}
          className="mt-1 h-4 w-4 accent-cyan-400"
        />
        <label htmlFor="kvkk-consent" className="text-sm n-muted">
          <Link href="/privacy" target="_blank" className="text-cyan-400 hover:text-cyan-300 underline">Gizlilik Politikası</Link>&apos;nı ve{' '}
          <Link href="/terms" target="_blank" className="text-cyan-400 hover:text-cyan-300 underline">Kullanım Şartları</Link>&apos;nı okudum, kabul ediyorum. *
        </label>
      </div>
      {errors.kvkk_consent && <p className="text-rose-400 text-sm">{errors.kvkk_consent.message}</p>}

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      <button type="submit" disabled={isSubmitting} className="neon-btn">
        {isSubmitting ? 'Kayıt...' : 'Hesap Aç'}
      </button>

      <p className="text-center text-sm n-muted">
        Hesabın var mı? <Link href="/parent-login" className="text-cyan-400 hover:text-cyan-300">Giriş yap</Link>
      </p>
    </form>
  );
}
