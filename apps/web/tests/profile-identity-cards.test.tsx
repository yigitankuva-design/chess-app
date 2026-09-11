import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ProfileView } from '@/components/profile/ProfileView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), token: 'tok', role: 'child', userId: '1' }),
}));

vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Test Sporcu',
}));

const resizeImageToDataUrl = vi.fn();
vi.mock('@/lib/image/resizeImage', () => ({
  resizeImageToDataUrl: (...args: unknown[]) => resizeImageToDataUrl(...args),
}));

const uploadMyPhoto = vi.fn();
const updateMyProfile = vi.fn();
vi.mock('@/lib/gamification/meApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gamification/meApi')>();
  return {
    ...actual,
    uploadMyPhoto: (...args: unknown[]) => uploadMyPhoto(...args),
    updateMyProfile: (...args: unknown[]) => updateMyProfile(...args),
  };
});

const ME = {
  rank_name: 'Çaylak', rank_icon: '🐣', xp_total: 10, next_rank_xp: 100,
  badges_earned: 1, badges_total: 5, member_since: '2018-08-07',
  photo_data_url: null as string | null,
  province: 'Bilecik',
  athlete_phone: '05551234567', athlete_email: 'sporcu@example.com',
  lichess_username: 'sporcuchess' as string | null,
  country: null as string | null, nickname: null as string | null,
  nickname_changed_at: null as string | null, nickname_next_change_at: null as string | null,
  father_name: 'Baba', father_phone: '05559876543', father_email: null,
  mother_name: 'Anne', mother_phone: null, mother_email: 'anne@example.com',
};

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/activity/day-summary')) return Promise.resolve({ ok: false, json: async () => null });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(ME) });
  }) as unknown as typeof fetch);
}

describe('Profil sayfası — kimlik kartları: il + üyelik tarihi (madde 2026-09-07, GRUP C)', () => {
  beforeEach(() => { stubFetch(); resizeImageToDataUrl.mockReset(); uploadMyPhoto.mockReset(); updateMyProfile.mockReset(); });

  it('Türkiye yanında il bilgisi ve üyelik tarihi gösterilir', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    expect(screen.getByText(/Bilecik/)).toBeInTheDocument();
    expect(screen.getByText(/Üyelik tarihi 7 Ağu 2018/)).toBeInTheDocument();
  });

  it('madde 2026-09-07 (5): Türkiye bayrağı text-5xl (önceki text-2xl\'in tam iki katı) ile büyütülmüş — antrenör profiliyle AYNI değişiklik', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    expect(screen.getByText('🇹🇷')).toHaveClass('text-5xl');
  });

  it('madde 2026-09-09: bayrak/ülke+il/üyelik tarihi ARTIK ayrı ayrı sütunlarda, aralarında dikey ayırıcı çizgi var', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    const flag = screen.getByText('🇹🇷');
    const row = flag.parentElement;
    // flag | çizgi | ülke+il | çizgi | üyelik tarihi = 5 çocuk.
    expect(row?.children.length).toBe(5);
  });
});

describe('Profil sayfası — kimlik kartı: isim/nickname ayrımı (madde 2026-09-09)', () => {
  beforeEach(() => { stubFetch(); resizeImageToDataUrl.mockReset(); uploadMyPhoto.mockReset(); updateMyProfile.mockReset(); });

  it('kimlik kartı ortadan dikey çizgiyle ikiye bölünür, solda İsim solda gerçek isim, sağda Nickname etiketi', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    expect(screen.getByText('İsim')).toBeInTheDocument();
    expect(screen.getByText('Nickname')).toBeInTheDocument();
    // Madde 2026-09-11 (Aşama B): nickname artık gerçek alan; boşken bu yer tutucu.
    expect(screen.getByText('Henüz eklenmedi')).toBeInTheDocument();
  });
});

describe('Profil sayfası — İletişim Bilgileri kartı (madde 2026-09-07, GRUP C)', () => {
  beforeEach(() => { stubFetch(); resizeImageToDataUrl.mockReset(); uploadMyPhoto.mockReset(); updateMyProfile.mockReset(); });

  it('varsayılan olarak hiçbir kişi seçili değil, bilgi gösterilmez', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    expect(screen.queryByText('05551234567')).not.toBeInTheDocument();
  });

  it('"Sporcu" seçilince sporcunun telefon/e-postası görünür', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    fireEvent.click(screen.getByText('Sporcu'));
    expect(screen.getByText('05551234567')).toBeInTheDocument();
    expect(screen.getByText('sporcu@example.com')).toBeInTheDocument();
  });

  it('madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): "Sporcu" seçilince Lichess kullanıcı adı da görünür, Baba/Anne\'de YOK', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    fireEvent.click(screen.getByText('Sporcu'));
    expect(screen.getByText('sporcuchess')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sporcu')); // kapat
    fireEvent.click(screen.getByText('Baba'));
    expect(screen.queryByText('sporcuchess')).not.toBeInTheDocument();
  });

  it('"Baba" seçilince eksik e-posta "E-posta girilmedi" olarak gösterilir', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    fireEvent.click(screen.getByText('Baba'));
    expect(screen.getByText('05559876543')).toBeInTheDocument();
    expect(screen.getByText('E-posta girilmedi')).toBeInTheDocument();
  });

  it('"Anne" seçilince eksik telefon "Telefon girilmedi" olarak gösterilir', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    fireEvent.click(screen.getByText('Anne'));
    expect(screen.getByText('Telefon girilmedi')).toBeInTheDocument();
    expect(screen.getByText('anne@example.com')).toBeInTheDocument();
  });

  it('aynı pill\'e tekrar tıklanınca kapanır', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    fireEvent.click(screen.getByText('Sporcu'));
    expect(screen.getByText('05551234567')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sporcu'));
    expect(screen.queryByText('05551234567')).not.toBeInTheDocument();
  });
});

describe('Profil sayfası — fotoğraf yükleme (madde 2026-09-07, GRUP C)', () => {
  beforeEach(() => { stubFetch(); resizeImageToDataUrl.mockReset(); uploadMyPhoto.mockReset(); updateMyProfile.mockReset(); });

  it('dosya seçilince küçültülür ve yüklenir, başarılıysa fotoğraf gösterilir', async () => {
    resizeImageToDataUrl.mockResolvedValue('data:image/jpeg;base64,xyz');
    uploadMyPhoto.mockResolvedValue(true);
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));

    const input = screen.getByLabelText('Fotoğraf yükle') as HTMLInputElement;
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadMyPhoto).toHaveBeenCalledWith('data:image/jpeg;base64,xyz'));
    await waitFor(() => expect(screen.getByAltText('Test Sporcu')).toHaveAttribute('src', 'data:image/jpeg;base64,xyz'));
  });

  it('yükleme başarısız olursa hata mesajı gösterilir', async () => {
    resizeImageToDataUrl.mockResolvedValue('data:image/jpeg;base64,xyz');
    uploadMyPhoto.mockResolvedValue(false);
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));

    const input = screen.getByLabelText('Fotoğraf yükle') as HTMLInputElement;
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => screen.getByText(/Fotoğraf yüklenemedi/));
  });

  it('antrenör (salt-okunur) görünümünde fotoğraf alanı tıklanabilir DEĞİL (dosya girişi yok)', async () => {
    render(<ProfileView childId={7} />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    expect(screen.queryByLabelText('Fotoğraf yükle')).not.toBeInTheDocument();
  });
});

describe('Madde 2026-09-11 (Görsel Turu Aşama B / Madde 3): sporcu profil düzenleme', () => {
  beforeEach(() => { stubFetch(); resizeImageToDataUrl.mockReset(); uploadMyPhoto.mockReset(); updateMyProfile.mockReset(); });

  it('isim ve e-posta salt-okunur; nickname/ülke-il/iletişim için Düzenle var', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    expect(screen.queryByLabelText('İsim')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nickname düzenle')).toBeInTheDocument();
    expect(screen.getByLabelText('Ülke ve şehir düzenle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sporcu'));
    expect(screen.getByLabelText('İletişim bilgilerini düzenle')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('İletişim bilgilerini düzenle'));
    expect(screen.queryByLabelText('E-posta')).not.toBeInTheDocument();
    expect(screen.getByText('(değiştirilemez)')).toBeInTheDocument();
  });

  it('nickname kaydedilince updateMyProfile çağrılır, yeni değer görünür ve kilit ipucu gelir', async () => {
    updateMyProfile.mockResolvedValue({ ok: true, data: {
      country: 'Türkiye', province: 'Bilecik', athlete_phone: '05551234567', lichess_username: 'sporcuchess',
      nickname: 'Şahin', nickname_changed_at: '2026-09-11T00:00:00Z',
      nickname_next_change_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    } });
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    fireEvent.click(screen.getByLabelText('Nickname düzenle'));
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Şahin' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledWith({ nickname: 'Şahin' }));
    await waitFor(() => screen.getByText('Şahin'));
    expect(screen.getByText('Test Sporcu')).toBeInTheDocument(); // gerçek isim yerinde
    expect(screen.getByText(/90 gün sonra değiştirebilirsin/)).toBeInTheDocument();
  });

  it('Baba/Anne sekmesinde Düzenle YOK (veli bilgisi burada düzenlenmez)', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    fireEvent.click(screen.getByText('Baba'));
    expect(screen.queryByLabelText('İletişim bilgilerini düzenle')).not.toBeInTheDocument();
  });

  it('antrenör (salt-okunur) görünümünde hiçbir Düzenle düğmesi yok', async () => {
    render(<ProfileView childId={7} />);
    await waitFor(() => screen.getByText('İletişim Bilgileri'));
    fireEvent.click(screen.getByText('Sporcu'));
    expect(screen.queryByLabelText(/düzenle/i)).not.toBeInTheDocument();
  });
});
