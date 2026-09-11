import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoachNoteCard } from '@/components/profile/CoachNoteCard';

/**
 * Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): "Hoca notu" kartı —
 * sporcunun kendi görünümünde salt-okunur, antrenörün öğrenci görünümünde
 * (`canManage`) yazma/silme. S4: sadece SON not (ayrı "düzenle" ucu yok),
 * silinebilir.
 */
const NOTE = { text: 'Açılışta daha dikkatli ol.', teacher_name: 'Ahmet Hoca', created_at: '2026-09-11T10:00:00Z' };

describe('CoachNoteCard — sporcunun kendi görünümü (canManage=false)', () => {
  it('not varsa öğretmen adı + metni + tarihi gösterir, yönetim düğmeleri YOK', async () => {
    render(<CoachNoteCard note={NOTE} canManage={false} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Ahmet Hoca\'dan not')).toBeInTheDocument();
    expect(screen.getByText('Açılışta daha dikkatli ol.')).toBeInTheDocument();
    expect(screen.getByText(/11 Eylül 2026/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Notu değiştir')).not.toBeInTheDocument();
    expect(screen.queryByText('Sil')).not.toBeInTheDocument();
  });

  it('not yoksa placeholder gösterir', () => {
    render(<CoachNoteCard note={null} canManage={false} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Hoca notu eklendiğinde burada görünecek.')).toBeInTheDocument();
  });
});

describe('CoachNoteCard — antrenörün öğrenci görünümü (canManage=true)', () => {
  it('not yokken "Not yaz" ile yeni not yazılabilir, onSave çağrılır', async () => {
    const onSave = vi.fn(async () => true);
    render(<CoachNoteCard note={null} canManage onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Not yaz'));
    fireEvent.change(screen.getByLabelText('Not'), { target: { value: 'Aferin, çok çalışıyorsun!' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Aferin, çok çalışıyorsun!'));
    expect(screen.queryByLabelText('Not')).not.toBeInTheDocument(); // form kapandı
  });

  it('not varken "Notu değiştir" mevcut metni önceden doldurur', async () => {
    const onSave = vi.fn(async () => true);
    render(<CoachNoteCard note={NOTE} canManage onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Notu değiştir'));
    expect(screen.getByLabelText('Not')).toHaveValue('Açılışta daha dikkatli ol.');
    fireEvent.change(screen.getByLabelText('Not'), { target: { value: 'Yeni metin' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Yeni metin'));
  });

  it('boş not gönderilemez (kaydet öncesi engellenir)', async () => {
    const onSave = vi.fn();
    render(<CoachNoteCard note={null} canManage onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Not yaz'));
    fireEvent.change(screen.getByLabelText('Not'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => screen.getByText('Not boş olamaz'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('"Sil" onDelete çağırır', async () => {
    const onDelete = vi.fn(async () => true);
    render(<CoachNoteCard note={NOTE} canManage onSave={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Sil'));
    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });

  it('"Sil" düğmesi not YOKKEN görünmez', () => {
    render(<CoachNoteCard note={null} canManage onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('Sil')).not.toBeInTheDocument();
  });

  it('kaydetme başarısız olursa hata mesajı gösterilir, form açık kalır', async () => {
    const onSave = vi.fn(async () => false);
    render(<CoachNoteCard note={null} canManage onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Not yaz'));
    fireEvent.change(screen.getByLabelText('Not'), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => screen.getByText('Kaydedilemedi, tekrar dene'));
    expect(screen.getByLabelText('Not')).toBeInTheDocument();
  });
});
