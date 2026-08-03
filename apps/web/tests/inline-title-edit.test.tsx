import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineTitleEdit } from '@/components/admin/InlineTitleEdit';

describe('InlineTitleEdit', () => {
  it('düzenle tıklanınca input açılır, kaydet ile onSave çağrılır', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<InlineTitleEdit value="Eski Başlık" onSave={onSave} ariaLabel="Başlığı düzenle" />);
    fireEvent.click(screen.getByLabelText('Başlığı düzenle'));
    fireEvent.change(screen.getByLabelText('Başlığı düzenle'), { target: { value: 'Yeni Başlık' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Yeni Başlık'));
  });

  it('boş başlık kaydedilmez, hata gösterilir', () => {
    const onSave = vi.fn();
    render(<InlineTitleEdit value="Başlık" onSave={onSave} ariaLabel="Başlığı düzenle" />);
    fireEvent.click(screen.getByLabelText('Başlığı düzenle'));
    fireEvent.change(screen.getByLabelText('Başlığı düzenle'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Kaydet'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Başlık boş olamaz')).toBeInTheDocument();
  });

  it('iptal ile eski değere döner, onSave çağrılmaz', () => {
    const onSave = vi.fn();
    render(<InlineTitleEdit value="Sabit" onSave={onSave} ariaLabel="Başlığı düzenle" />);
    fireEvent.click(screen.getByLabelText('Başlığı düzenle'));
    fireEvent.change(screen.getByLabelText('Başlığı düzenle'), { target: { value: 'Değişti' } });
    fireEvent.click(screen.getByText('İptal'));
    expect(screen.getByText('Sabit')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('düzenle butonuna tıklamak dış tıklama olaylarını (Link navigasyonu) durdurur', () => {
    const outerClick = vi.fn();
    const onSave = vi.fn();
    render(
      <div onClick={outerClick}>
        <InlineTitleEdit value="Başlık" onSave={onSave} ariaLabel="Başlığı düzenle" />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Başlığı düzenle'));
    expect(outerClick).not.toHaveBeenCalled();
  });
});
