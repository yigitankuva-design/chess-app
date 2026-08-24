import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PositionPoolView, POOL_ROW_SIZE } from '@/components/admin/PositionPoolView';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN2 = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1';

function poz(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, fen: FEN }));
}

function setup(over: Partial<React.ComponentProps<typeof PositionPoolView>> = {}) {
  const props = {
    pool: poz(3),
    onUpdatePosition: vi.fn(),
    onDeletePosition: vi.fn(),
    ...over,
  };
  render(<PositionPoolView {...props} />);
  return props;
}

describe('PositionPoolView — havuz kartı', () => {
  it('kapalıyken kodlar görünmez, kart üzerinde sayı yazar', () => {
    setup();
    expect(screen.getByText(/Konum Havuzu/)).toBeInTheDocument();
    expect(screen.getByText(/Konum Havuzu/).closest('button')).toHaveTextContent('3');
    expect(screen.queryByRole('button', { name: 'Konum 001' })).not.toBeInTheDocument();
  });

  it('karta tıklayınca kod kartları açılır', () => {
    setup();
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    expect(screen.getByRole('button', { name: 'Konum 001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konum 003' })).toBeInTheDocument();
  });

  it('satır boyutu 12’dir', () => {
    expect(POOL_ROW_SIZE).toBe(12);
  });

  it('13 konumda ikinci satır 013 ile başlar', () => {
    setup({ pool: poz(13) });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    const satirlar = screen.getAllByTestId('kod-satiri');
    expect(satirlar).toHaveLength(2);
    expect(satirlar[0].children).toHaveLength(12);
    expect(satirlar[1]).toHaveTextContent('013');
  });

  it('kayıtlı kod korunur, kodsuza boşta olan numara verilir', () => {
    setup({ pool: [{ id: 'a', fen: FEN, code: '007' }, { id: 'b', fen: FEN }] });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    expect(screen.getByRole('button', { name: 'Konum 007' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konum 001' })).toBeInTheDocument();
  });

  it('havuz boşken kart yine görünür, açılınca bilgi metni çıkar', () => {
    setup({ pool: [] });
    expect(screen.getByText(/Konum Havuzu/).closest('button')).toHaveTextContent('0');
    expect(screen.queryByText(/Henüz konum eklenmedi/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    expect(screen.getByText(/Henüz konum eklenmedi/)).toBeInTheDocument();
  });
});

describe('PositionPoolView — düzenleme', () => {
  it('koda tıklayınca düzenleme açılır', () => {
    setup();
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 002' }));
    expect(screen.getByText('Değişikliği Kaydet')).toBeInTheDocument();
    expect(screen.getByText('Vazgeç')).toBeInTheDocument();
  });

  it('Değişikliği Kaydet konumu KOD DEĞİŞTİRMEDEN günceller', () => {
    const p = setup({ pool: [{ id: 'a', fen: FEN, code: '005' }] });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 005' }));
    fireEvent.click(screen.getByText('Değişikliği Kaydet'));
    expect(p.onUpdatePosition).toHaveBeenCalledWith('a', expect.objectContaining({ code: '005' }));
  });

  it('kodsuz konum düzenlenince gösterilen kod kalıcı olarak yazılır', () => {
    const p = setup({ pool: [{ id: 'a', fen: FEN }] });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    fireEvent.click(screen.getByText('Değişikliği Kaydet'));
    expect(p.onUpdatePosition).toHaveBeenCalledWith('a', expect.objectContaining({ code: '001' }));
  });

  it('Vazgeç düzenlemeyi kapatır, kaydetmez', () => {
    const p = setup();
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(p.onUpdatePosition).not.toHaveBeenCalled();
    expect(screen.queryByText('Değişikliği Kaydet')).not.toBeInTheDocument();
  });

  it('Sil konumu kaldırır', () => {
    const p = setup({ pool: [{ id: 'a', fen: FEN2, code: '001' }] });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    fireEvent.click(screen.getByText('Sil'));
    expect(p.onDeletePosition).toHaveBeenCalledWith('a');
  });
});

describe('PositionPoolView — Konumun Sahibi düzenleme (madde 2026-08-30, showOwnerField)', () => {
  it('showOwnerField kapalıyken (varsayılan) düzenleme ekranında "Konumun Sahibi" alanı YOKTUR', () => {
    setup({ pool: [{ id: 'a', fen: FEN, code: '001', owner: 'Ali - Veli' }] });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    expect(screen.queryByText('Konumun Sahibi')).not.toBeInTheDocument();
  });

  it('showOwnerField açıkken mevcut sahip değeriyle önceden doldurulur ve düzenlenip kaydedilebilir', () => {
    const p = setup({
      pool: [{ id: 'a', fen: FEN, code: '001', owner: 'Ali - Veli' }],
      showOwnerField: true,
    });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    const input = screen.getByLabelText('Konumun Sahibi') as HTMLInputElement;
    expect(input.value).toBe('Ali - Veli');

    fireEvent.change(input, { target: { value: 'Zafer - Öğrenci' } });
    fireEvent.click(screen.getByText('Değişikliği Kaydet'));
    expect(p.onUpdatePosition).toHaveBeenCalledWith(
      'a', expect.objectContaining({ owner: 'Zafer - Öğrenci' }),
    );
  });

  it('showOwnerField açıkken sahip alanı boşaltılıp kaydedilirse owner null olur', () => {
    const p = setup({
      pool: [{ id: 'a', fen: FEN, code: '001', owner: 'Ali - Veli' }],
      showOwnerField: true,
    });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    fireEvent.change(screen.getByLabelText('Konumun Sahibi'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Değişikliği Kaydet'));
    expect(p.onUpdatePosition).toHaveBeenCalledWith('a', expect.objectContaining({ owner: null }));
  });
});
