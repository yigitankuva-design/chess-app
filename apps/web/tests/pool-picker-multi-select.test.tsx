import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PoolPicker } from '@/components/admin/PoolPicker';
import * as poolApi from '@/lib/admin/poolApi';

vi.mock('@/lib/admin/poolApi', async () => {
  const actual = await vi.importActual<typeof poolApi>('@/lib/admin/poolApi');
  return { ...actual, fetchPoolImages: vi.fn() };
});

describe('PoolPicker — çoklu seçim (onSelectMultiple)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tek seçim modu (onSelect) eski davranışı korur — tıklayınca hemen seçer ve kapanır', async () => {
    vi.mocked(poolApi.fetchPoolImages).mockResolvedValue([
      { id: 1, category: 'Hayvanlar', data_uri: 'data:image/png;base64,A' },
    ]);
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<PoolPicker onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText('Hayvanlar'));
    const img = await screen.findByAltText('Hayvanlar havuz görseli');
    fireEvent.click(img);
    expect(onSelect).toHaveBeenCalledWith('data:image/png;base64,A');
    expect(onClose).toHaveBeenCalled();
  });

  it('çoklu seçim modunda (onSelectMultiple) farklı kategorilerden seçimler sepette birikir', async () => {
    vi.mocked(poolApi.fetchPoolImages)
      .mockResolvedValueOnce([{ id: 1, category: 'Hayvanlar', data_uri: 'data:image/png;base64,A' }])
      .mockResolvedValueOnce([{ id: 2, category: 'Bitkiler', data_uri: 'data:image/png;base64,B' }]);
    const onSelectMultiple = vi.fn();
    render(<PoolPicker onSelectMultiple={onSelectMultiple} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Hayvanlar'));
    const img1 = await screen.findByLabelText('Hayvanlar havuz görseli');
    fireEvent.click(img1);

    fireEvent.click(screen.getByText('Bitkiler'));
    const img2 = await screen.findByLabelText('Bitkiler havuz görseli');
    fireEvent.click(img2);

    expect(screen.getByLabelText('Bitkiler havuz görseli (seçili)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Seçilenleri Ekle (2)'));
    expect(onSelectMultiple).toHaveBeenCalledWith([
      'data:image/png;base64,A', 'data:image/png;base64,B',
    ]);
  });

  it('çoklu seçim modunda tekrar tıklamak seçimi geri alır', async () => {
    vi.mocked(poolApi.fetchPoolImages).mockResolvedValue([
      { id: 1, category: 'Hayvanlar', data_uri: 'data:image/png;base64,A' },
    ]);
    render(<PoolPicker onSelectMultiple={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Hayvanlar'));
    const img = await screen.findByLabelText('Hayvanlar havuz görseli');
    fireEvent.click(img);
    expect(await screen.findByLabelText('Hayvanlar havuz görseli (seçili)')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Hayvanlar havuz görseli (seçili)'));
    await waitFor(() => expect(screen.queryByText(/Seçilenleri Ekle/)).not.toBeInTheDocument());
  });
});
