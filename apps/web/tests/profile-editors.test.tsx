import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactEditor, LocationEditor, NicknameEditor, nicknameLockDays } from '@/components/profile/ProfileEditors';
import type { ProfileEditOutcome, ProfileEditResult } from '@/lib/gamification/meApi';

/**
 * Madde 2026-09-11 (Görsel Turu Aşama B / Madde 3): profil kartlarındaki
 * yerinde düzenleme parçaları — sporcu ve antrenör AYNI bileşenleri kullanır.
 */
const OK = (over: Partial<ProfileEditResult> = {}): ProfileEditOutcome => ({
  ok: true,
  data: {
    country: 'Türkiye', province: null, athlete_phone: null, lichess_username: null,
    nickname: null, nickname_changed_at: null, nickname_next_change_at: null, ...over,
  },
});
const ICONS = { phone: <i data-testid="i-phone" />, mail: <i data-testid="i-mail" />, knight: <i data-testid="i-knight" /> };

describe('nicknameLockDays', () => {
  it('tarih yoksa / geçmişse null, gelecekteyse yukarı yuvarlanmış gün', () => {
    const now = new Date('2026-09-11T10:00:00Z');
    expect(nicknameLockDays(null, now)).toBeNull();
    expect(nicknameLockDays('2026-09-01T00:00:00Z', now)).toBeNull();
    expect(nicknameLockDays('2026-09-12T09:00:00Z', now)).toBe(1);
    expect(nicknameLockDays('2026-12-10T10:00:00Z', now)).toBe(90);
  });
});

describe('NicknameEditor', () => {
  it('nickname yoksa "Henüz eklenmedi" + Düzenle; kaydedince yeni değer görünür ve onSaved çağrılır', async () => {
    const onSave = vi.fn(async () => OK({ nickname: 'Şahin', nickname_next_change_at: '2099-01-01T00:00:00Z' }));
    const onSaved = vi.fn();
    render(<NicknameEditor value={null} nextChangeAt={null} onSave={onSave} onSaved={onSaved} />);
    expect(screen.getByText('Henüz eklenmedi')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Nickname düzenle'));
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Şahin' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ nickname: 'Şahin' }));
    expect(onSaved).toHaveBeenCalledWith('Şahin', '2099-01-01T00:00:00Z');
    expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument();
  });

  it('sunucu 409 (kilit/benzersizlik) dönerse hata metni formda kalır', async () => {
    const onSave = vi.fn(async (): Promise<ProfileEditOutcome> => ({ ok: false, error: 'Bu nickname zaten kullanılıyor' }));
    render(<NicknameEditor value="Fil" nextChangeAt={null} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Nickname düzenle'));
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Vezir' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => screen.getByText('Bu nickname zaten kullanılıyor'));
    expect(screen.getByLabelText('Nickname')).toBeInTheDocument(); // form açık kaldı
  });

  it('3 ay kilidi doluysa Düzenle YOK, "X gün sonra değiştirebilirsin" ipucu var', () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    render(<NicknameEditor value="Fil" nextChangeAt={future} onSave={vi.fn()} />);
    expect(screen.queryByLabelText('Nickname düzenle')).not.toBeInTheDocument();
    expect(screen.getByText(/10 gün sonra değiştirebilirsin/)).toBeInTheDocument();
  });

  it('readOnly (antrenör görünümü): Düzenle de ipucu da YOK, sadece değer', () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    render(<NicknameEditor value="Fil" nextChangeAt={future} readOnly onSave={vi.fn()} />);
    expect(screen.getByText('Fil')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nickname düzenle')).not.toBeInTheDocument();
    expect(screen.queryByText(/gün sonra/)).not.toBeInTheDocument();
  });

  it('Vazgeç formu kapatır, kaydetmez', () => {
    const onSave = vi.fn();
    render(<NicknameEditor value="Fil" nextChangeAt={null} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Nickname düzenle'));
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Fil')).toBeInTheDocument();
  });
});

describe('LocationEditor', () => {
  it('ülke listesi (Türkiye varsayılan) + 81 il; seçip kaydedince patch {country, province}', async () => {
    const onSave = vi.fn(async () => OK({ province: 'Bilecik' }));
    const onSaved = vi.fn();
    render(<LocationEditor country={null} province={null} memberSinceLabel="7 Ağu 2018" onSave={onSave} onSaved={onSaved} />);
    expect(screen.getByText('Türkiye')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Ülke ve şehir düzenle'));
    const ulke = screen.getByLabelText('Ülke') as HTMLSelectElement;
    const sehir = screen.getByLabelText('Şehir') as HTMLSelectElement;
    expect(ulke.value).toBe('Türkiye');
    expect(sehir.options.length).toBe(82); // "— Seç —" + 81 il
    fireEvent.change(sehir, { target: { value: 'Bilecik' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ country: 'Türkiye', province: 'Bilecik' }));
    expect(onSaved).toHaveBeenCalledWith('Türkiye', 'Bilecik');
  });

  it('readOnly: Düzenle yok; il parantez içinde gösterilir', () => {
    render(<LocationEditor country="Türkiye" province="İzmir" memberSinceLabel="x" readOnly onSave={vi.fn()} />);
    expect(screen.queryByLabelText('Ülke ve şehir düzenle')).not.toBeInTheDocument();
    expect(screen.getByText('(İzmir)')).toBeInTheDocument();
  });
});

describe('ContactEditor', () => {
  it('telefon + Lichess düzenlenir, e-posta salt-okunur; kaydedince patch {athlete_phone, lichess_username}', async () => {
    const onSave = vi.fn(async () => OK({ athlete_phone: '0555', lichess_username: 'yeni' }));
    const onSaved = vi.fn();
    render(<ContactEditor phone={null} email="a@b.com" lichess={null} onSave={onSave} onSaved={onSaved} icons={ICONS} />);
    expect(screen.getByText('Telefon girilmedi')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('İletişim bilgilerini düzenle'));
    expect(screen.queryByLabelText('E-posta')).not.toBeInTheDocument();
    expect(screen.getByText('(değiştirilemez)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '0555' } });
    fireEvent.change(screen.getByLabelText('Lichess kullanıcı adı'), { target: { value: 'yeni' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ athlete_phone: '0555', lichess_username: 'yeni' }));
    expect(onSaved).toHaveBeenCalledWith('0555', 'yeni');
  });

  it('readOnly: Düzenle yok', () => {
    render(<ContactEditor phone="1" email="a@b.com" lichess="l" readOnly onSave={vi.fn()} icons={ICONS} />);
    expect(screen.queryByLabelText('İletişim bilgilerini düzenle')).not.toBeInTheDocument();
  });
});
