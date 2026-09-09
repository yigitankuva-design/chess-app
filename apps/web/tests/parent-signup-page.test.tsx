import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Madde 2026-09-09 (Üyelik Girişi Yenileme): "Kayıt Ol" formu tamamen
// yeniden tasarlandı — bu testler yeni Üye/Antrenör akışlarını,
// zorunlu/isteğe bağlı alan kurallarını ve 18+ onay bekleme davranışını
// doğrular (bkz. auth.py member_signup/teacher_register).

const {
  push, login, saveAthleteName, saveTeacherName,
  memberSignup, teacherRegister, athleteSession, MockApiError,
} = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    push: vi.fn(), login: vi.fn(),
    saveAthleteName: vi.fn(), saveTeacherName: vi.fn(),
    memberSignup: vi.fn(), teacherRegister: vi.fn(), athleteSession: vi.fn(),
    MockApiError,
  };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ login, logout: vi.fn(), token: null, role: null, userId: null }) }));
vi.mock('@/lib/auth-storage', () => ({ saveAthleteName, saveTeacherName }));
vi.mock('@/lib/api-client', () => ({
  apiClient: { memberSignup, teacherRegister, athleteSession },
  ApiError: MockApiError,
}));

import SignupPage from '@/app/(auth)/parent-signup/page';

function fillCommonMemberFields() {
  fireEvent.change(screen.getByPlaceholderText('İsim *'), { target: { value: 'Ali' } });
  fireEvent.change(screen.getByPlaceholderText('Soyisim *'), { target: { value: 'Yılmaz' } });
  fireEvent.change(screen.getByPlaceholderText('Telefon *'), { target: { value: '5551112233' } });
  fireEvent.change(screen.getByPlaceholderText('E-posta *'), { target: { value: 'ali@test.com' } });
  fireEvent.change(screen.getByPlaceholderText('Şehir *'), { target: { value: 'Bilecik' } });
  fireEvent.change(screen.getByPlaceholderText('Kullanıcı Adı *'), { target: { value: 'aliyilmaz' } });
  fireEvent.change(screen.getByPlaceholderText('Şifre (en az 8 karakter) *'), { target: { value: 'guvenli1234' } });
  fireEvent.change(screen.getByLabelText('Doğum Tarihi *'), { target: { value: '2000-01-01' } });
}

function acceptKvkk() {
  fireEvent.click(screen.getByLabelText(/Gizlilik Politikası/));
}

beforeEach(() => {
  push.mockClear();
  login.mockClear();
  saveAthleteName.mockClear();
  saveTeacherName.mockClear();
  memberSignup.mockReset();
  teacherRegister.mockReset();
  athleteSession.mockReset();
});

describe('Kayıt Ol — Üye/Antrenör düzeni (madde 2026-09-09)', () => {
  it('varsayılan olarak "Üye" seçili, Antrenör\'e geçilince veli bölümü kaybolur', () => {
    render(<SignupPage />);
    expect(screen.getByText('Veli bilgileri (Anne)')).toBeInTheDocument();
    expect(screen.getByText('Veli bilgileri (Baba)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('🎓 Antrenör'));
    expect(screen.queryByText('Veli bilgileri (Anne)')).not.toBeInTheDocument();
    expect(screen.queryByText('Veli bilgileri (Baba)')).not.toBeInTheDocument();
    expect(screen.getByText('Üyelik Bilgileri (Antrenör)')).toBeInTheDocument();
  });

  it('Lichess Kullanıcı Adı zorunlu DEĞİL — yıldız yok', () => {
    render(<SignupPage />);
    expect(screen.getByPlaceholderText('Lichess Kullanıcı Adı')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Lichess Kullanıcı Adı *')).not.toBeInTheDocument();
  });

  it('Anne VEYA Baba\'dan en az biri tam doldurulmadan gönderilemez', async () => {
    render(<SignupPage />);
    fillCommonMemberFields();
    acceptKvkk();
    fireEvent.click(screen.getByText('Hesap Aç'));
    await waitFor(() => {
      expect(screen.getByText(/Anne veya Baba bilgilerinden en az biri/)).toBeInTheDocument();
    });
    expect(memberSignup).not.toHaveBeenCalled();
  });

  it('sadece Anne doldurulunca gönderilebilir, İsim+Soyisim TEK alanda birleşir', async () => {
    memberSignup.mockResolvedValue({
      access_token: 'tok', role: 'parent', user_id: 1, name: 'Ali Yılmaz', approval_status: 'approved',
    });
    athleteSession.mockResolvedValue({ access_token: 'ctok', child_profile_id: 5, display_name: 'Ali Yılmaz' });

    render(<SignupPage />);
    fillCommonMemberFields();
    fireEvent.change(screen.getAllByPlaceholderText('İsim')[0], { target: { value: 'Ayşe' } });
    fireEvent.change(screen.getAllByPlaceholderText('Soyisim')[0], { target: { value: 'Yılmaz' } });
    fireEvent.change(screen.getAllByPlaceholderText('Telefon')[0], { target: { value: '5551112244' } });
    fireEvent.change(screen.getAllByPlaceholderText('E-posta')[0], { target: { value: 'ayse@test.com' } });
    acceptKvkk();
    fireEvent.click(screen.getByText('Hesap Aç'));

    await waitFor(() => expect(memberSignup).toHaveBeenCalledTimes(1));
    const body = memberSignup.mock.calls[0][0];
    expect(body.mother_name).toBe('Ayşe Yılmaz');
    expect(body.father_name).toBeUndefined();
    expect(body.birth_date).toBe('2000-01-01');

    // 18+ ama approval_status backend'den 'approved' geldiyse (test amaçlı) otomatik giriş.
    await waitFor(() => expect(athleteSession).toHaveBeenCalled());
    expect(saveAthleteName).toHaveBeenCalledWith('Ali Yılmaz');
    expect(push).toHaveBeenCalledWith('/home');
  });

  it('madde 2026-09-09 (devam 4): 18+ kaydolan sporcu (role=athlete) ONAY BEKLEMEZ, hemen /dashboard\'a gider', async () => {
    memberSignup.mockResolvedValue({
      access_token: 'tok', role: 'athlete', user_id: 2, name: 'Ali Yılmaz', approval_status: 'approved',
    });

    render(<SignupPage />);
    fillCommonMemberFields();
    fireEvent.change(screen.getAllByPlaceholderText('İsim')[0], { target: { value: 'Ayşe' } });
    fireEvent.change(screen.getAllByPlaceholderText('Soyisim')[0], { target: { value: 'Yılmaz' } });
    fireEvent.change(screen.getAllByPlaceholderText('Telefon')[0], { target: { value: '5551112244' } });
    fireEvent.change(screen.getAllByPlaceholderText('E-posta')[0], { target: { value: 'ayse@test.com' } });
    acceptKvkk();
    fireEvent.click(screen.getByText('Hesap Aç'));

    await waitFor(() => expect(login).toHaveBeenCalledWith('tok', 'athlete', 2));
    expect(saveAthleteName).toHaveBeenCalledWith('Ali Yılmaz');
    expect(athleteSession).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByText('Hesabın Oluşturuldu')).not.toBeInTheDocument();
  });

  it('KVKK onayı işaretlenmeden gönderilemez', async () => {
    render(<SignupPage />);
    fillCommonMemberFields();
    fireEvent.change(screen.getAllByPlaceholderText('İsim')[0], { target: { value: 'Ayşe' } });
    fireEvent.change(screen.getAllByPlaceholderText('Soyisim')[0], { target: { value: 'Yılmaz' } });
    fireEvent.change(screen.getAllByPlaceholderText('Telefon')[0], { target: { value: '5551112244' } });
    fireEvent.change(screen.getAllByPlaceholderText('E-posta')[0], { target: { value: 'ayse@test.com' } });
    fireEvent.click(screen.getByText('Hesap Aç'));
    await waitFor(() => {
      expect(screen.getByText('KVKK onayı gerekli')).toBeInTheDocument();
    });
    expect(memberSignup).not.toHaveBeenCalled();
  });

  function fillTeacherFields() {
    fireEvent.click(screen.getByText('🎓 Antrenör'));
    fireEvent.change(screen.getByPlaceholderText('İsim *'), { target: { value: 'Zeynep' } });
    fireEvent.change(screen.getByPlaceholderText('Soyisim *'), { target: { value: 'Kara' } });
    fireEvent.change(screen.getByPlaceholderText('Telefon *'), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByPlaceholderText('E-posta *'), { target: { value: 'zeynep@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Şehir *'), { target: { value: 'Bilecik' } });
    fireEvent.change(screen.getByPlaceholderText('Kullanıcı Adı *'), { target: { value: 'zeynepkara' } });
    fireEvent.change(screen.getByPlaceholderText('Şifre (en az 8 karakter) *'), { target: { value: 'guvenli1234' } });
  }

  it('madde 2026-09-09 (devam 4): Antrenör başvurusu doğru uca gönderir, veli bilgisi İSTEMEZ, ONAY BEKLER (giriş YAPMAZ)', async () => {
    teacherRegister.mockResolvedValue({
      access_token: 'tok', role: 'teacher', user_id: 3, name: 'Zeynep Kara', approval_status: 'pending',
    });

    render(<SignupPage />);
    fillTeacherFields();
    acceptKvkk();
    fireEvent.click(screen.getByText('Hesap Aç'));

    await waitFor(() => expect(teacherRegister).toHaveBeenCalledTimes(1));
    expect(memberSignup).not.toHaveBeenCalled();
    const body = teacherRegister.mock.calls[0][0];
    expect(body.first_name).toBe('Zeynep');
    expect(body.last_name).toBe('Kara');

    await waitFor(() => {
      expect(screen.getByText('Hesabın Oluşturuldu')).toBeInTheDocument();
    });
    expect(screen.getByText(/başvurun akademi yönetimi tarafından incelenecek/)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(saveTeacherName).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('409 (kullanıcı adı/e-posta çakışması) hatası ekranda gösterilir', async () => {
    memberSignup.mockRejectedValue(new MockApiError(409, 'Kullanıcı adı zaten kullanılıyor'));

    render(<SignupPage />);
    fillCommonMemberFields();
    fireEvent.change(screen.getAllByPlaceholderText('İsim')[0], { target: { value: 'Ayşe' } });
    fireEvent.change(screen.getAllByPlaceholderText('Soyisim')[0], { target: { value: 'Yılmaz' } });
    fireEvent.change(screen.getAllByPlaceholderText('Telefon')[0], { target: { value: '5551112244' } });
    fireEvent.change(screen.getAllByPlaceholderText('E-posta')[0], { target: { value: 'ayse@test.com' } });
    acceptKvkk();
    fireEvent.click(screen.getByText('Hesap Aç'));

    await waitFor(() => {
      expect(screen.getByText('Kullanıcı adı zaten kullanılıyor')).toBeInTheDocument();
    });
  });
});
