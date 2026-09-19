import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// vi.mock hoisted — import'lardan önce çalışır.
vi.mock('@/lib/imageCompress', () => ({
  compressImageToDataUri: vi.fn(async () => 'data:image/jpeg;base64,FAKEICON'),
}));

import { IconPicker } from '@/components/admin/IconPicker';
import { compressImageToDataUri } from '@/lib/imageCompress';

function makeImageFile(): File {
  return new File(['fake-image-bytes'], 'icon.png', { type: 'image/png' });
}

beforeEach(() => vi.mocked(compressImageToDataUri).mockClear());

describe('IconPicker — showLevelBadges (madde 2026-09-05 (2))', () => {
  it('varsayılan olarak (showLevelBadges verilmezse) seviye rozetleri gösterilmez', () => {
    render(<IconPicker value={null} onChange={vi.fn()} ariaLabel="İkon seç" />);
    fireEvent.click(screen.getByLabelText('İkon seç'));
    expect(screen.queryByText('TD')).not.toBeInTheDocument();
    expect(screen.queryByText('Seviye Rozeti')).not.toBeInTheDocument();
  });

  it('showLevelBadges=true iken 5 seviye rozeti (TS/TD/BD/OD/İD) gösterilir', () => {
    render(<IconPicker value={null} onChange={vi.fn()} ariaLabel="İkon seç" showLevelBadges />);
    fireEvent.click(screen.getByLabelText('İkon seç'));
    for (const code of ['TS', 'TD', 'BD', 'OD', 'İD']) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });

  it('bir rozete tıklayınca onChange kodla çağrılır ve popover kapanır', () => {
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} ariaLabel="İkon seç" showLevelBadges />);
    fireEvent.click(screen.getByLabelText('İkon seç'));
    fireEvent.click(screen.getByText('TD'));
    expect(onChange).toHaveBeenCalledWith('TD');
    expect(screen.queryByText('Seviye Rozeti')).not.toBeInTheDocument();
  });

  it('value bir seviye koduysa kapalı düğmede rozet (kod metni) gösterilir', () => {
    render(<IconPicker value="OD" onChange={vi.fn()} ariaLabel="İkon seç" showLevelBadges />);
    expect(screen.getByLabelText('İkon seç')).toHaveTextContent('OD');
  });
});

describe('IconPicker — özel görsel yükleme (madde 2026-09-19)', () => {
  it('görsel seçilince sıkıştırılıp onChange data URL ile çağrılır, popover kapanır', async () => {
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} ariaLabel="İkon seç" />);
    fireEvent.click(screen.getByLabelText('İkon seç'));

    const file = makeImageFile();
    const input = screen.getByLabelText('İkon seç').parentElement!.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(vi.mocked(compressImageToDataUri)).toHaveBeenCalledWith(file, 60_000, 240));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('data:image/jpeg;base64,FAKEICON'));
    expect(screen.queryByText('🖼️ Kendi Görselini Yükle')).not.toBeInTheDocument();
  });

  it('value bir resim (data URL) ise kapalı düğmede <img> gösterilir ve "kaldır" seçeneği çıkar', () => {
    const onChange = vi.fn();
    render(<IconPicker value="data:image/png;base64,ABC" onChange={onChange} ariaLabel="İkon seç" />);
    const btn = screen.getByLabelText('İkon seç');
    expect(btn.querySelector('img')).toBeInTheDocument();

    fireEvent.click(btn);
    fireEvent.click(screen.getByText('Görseli kaldır (emoji havuzuna dön)'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('value emoji ise (resim değil) "kaldır" seçeneği gösterilmez', () => {
    render(<IconPicker value="🔔" onChange={vi.fn()} ariaLabel="İkon seç" />);
    fireEvent.click(screen.getByLabelText('İkon seç'));
    expect(screen.queryByText('Görseli kaldır (emoji havuzuna dön)')).not.toBeInTheDocument();
  });

  it('sıkıştırma başarısız olursa hata mesajı gösterir', async () => {
    vi.mocked(compressImageToDataUri).mockRejectedValueOnce(new Error('Görsel sıkıştırılamadı'));
    render(<IconPicker value={null} onChange={vi.fn()} ariaLabel="İkon seç" />);
    fireEvent.click(screen.getByLabelText('İkon seç'));

    const input = screen.getByLabelText('İkon seç').parentElement!.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeImageFile()] } });

    await waitFor(() => screen.getByText('Görsel yüklenemedi, tekrar dene.'));
  });
});
