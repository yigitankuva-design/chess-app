import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AltKonuPositionPoolFields } from '@/components/admin/AltKonuPositionPoolFields';
import type { PositionPoolEntry } from '@/lib/customTabsApi';

describe('AltKonuPositionPoolFields — Konum Havuzu (madde 2026-08-26)', () => {
  it('havuz boşken bilgi mesajı gösterir, sadece Buton Ekle görünür', () => {
    render(<AltKonuPositionPoolFields pool={[]} onAddGroup={vi.fn()} onDeleteGroup={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByText('Henüz konum grubu eklenmedi.')).toBeInTheDocument();
    expect(screen.getByText('Buton Ekle')).toBeInTheDocument();
    expect(screen.queryByText(/Havuza Ekle/)).not.toBeInTheDocument();
  });

  it('Buton Ekle basınca 1 numaralı buton ve düzenleme alanı (tahta+cümle+analiz) açılır', () => {
    render(<AltKonuPositionPoolFields pool={[]} onAddGroup={vi.fn()} onDeleteGroup={vi.fn()} onReorder={vi.fn()} />);
    fireEvent.click(screen.getByText('Buton Ekle'));
    expect(screen.getByLabelText('1. buton')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Bu konumla ilgili açıklama cümlesi')).toBeInTheDocument();
    expect(screen.getByText('🔍 Konumu Analiz Et')).toBeInTheDocument();
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
  });

  it('cümle boşken Konumu Kaydet hata gösterir, editörü kapatmaz', () => {
    render(<AltKonuPositionPoolFields pool={[]} onAddGroup={vi.fn()} onDeleteGroup={vi.fn()} onReorder={vi.fn()} />);
    fireEvent.click(screen.getByText('Buton Ekle'));
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(screen.getByText('Açıklama cümlesi gerekli')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Bu konumla ilgili açıklama cümlesi')).toBeInTheDocument();
  });

  it('cümle yazıp Konumu Kaydet basınca editör kapanır; butona tekrar tıklayınca cümle korunur', () => {
    render(<AltKonuPositionPoolFields pool={[]} onAddGroup={vi.fn()} onDeleteGroup={vi.fn()} onReorder={vi.fn()} />);
    fireEvent.click(screen.getByText('Buton Ekle'));
    fireEvent.change(screen.getByPlaceholderText('Bu konumla ilgili açıklama cümlesi'), {
      target: { value: 'Tahta 8x8 karelerden oluşur.' },
    });
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(screen.queryByPlaceholderText('Bu konumla ilgili açıklama cümlesi')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('1. buton'));
    expect(screen.getByDisplayValue('Tahta 8x8 karelerden oluşur.')).toBeInTheDocument();
  });

  it('iki buton eklenip Havuza Ekle\'ye basılınca onAddGroup 2 adımla çağrılır ve taslak sıfırlanır', async () => {
    const onAddGroup = vi.fn().mockResolvedValue(undefined);
    render(<AltKonuPositionPoolFields pool={[]} onAddGroup={onAddGroup} onDeleteGroup={vi.fn()} onReorder={vi.fn()} />);

    fireEvent.click(screen.getByText('Buton Ekle'));
    fireEvent.change(screen.getByPlaceholderText('Bu konumla ilgili açıklama cümlesi'), { target: { value: 'Adım 1' } });
    fireEvent.click(screen.getByText('Konumu Kaydet'));

    fireEvent.click(screen.getByText('Buton Ekle'));
    fireEvent.change(screen.getByPlaceholderText('Bu konumla ilgili açıklama cümlesi'), { target: { value: 'Adım 2' } });
    fireEvent.click(screen.getByText('Konumu Kaydet'));

    fireEvent.click(screen.getByText(/Havuza Ekle/));
    expect(onAddGroup).toHaveBeenCalledTimes(1);
    const steps = onAddGroup.mock.calls[0][0];
    expect(steps).toHaveLength(2);
    expect(steps[0].sentence).toBe('Adım 1');
    expect(steps[1].sentence).toBe('Adım 2');

    await waitFor(() => expect(screen.queryByLabelText('1. buton')).not.toBeInTheDocument());
  });

  it('kayıtlı gruplar kod ve adım sayısıyla listelenir; yukarı/aşağı onReorder\'ı, Sil onDeleteGroup\'u çağırır', () => {
    const onReorder = vi.fn();
    const onDeleteGroup = vi.fn();
    const pool: PositionPoolEntry[] = [
      { id: 'g1', code: '001', steps: [{ id: 's1', fen: 'x', sentence: 'a', turn: 'w' }] },
      { id: 'g2', code: '002', steps: [{ id: 's2', fen: 'x', sentence: 'b', turn: 'w' }, { id: 's3', fen: 'x', sentence: 'c', turn: 'b' }] },
    ];
    render(<AltKonuPositionPoolFields pool={pool} onAddGroup={vi.fn()} onDeleteGroup={onDeleteGroup} onReorder={onReorder} />);

    expect(screen.getByText('001')).toBeInTheDocument();
    expect(screen.getByText('002')).toBeInTheDocument();
    expect(screen.getByText('2 adım')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('002 kodunu yukarı taşı'));
    expect(onReorder).toHaveBeenCalledWith([pool[1], pool[0]]);

    fireEvent.click(screen.getByLabelText('001 kodunu sil'));
    expect(onDeleteGroup).toHaveBeenCalledWith('g1');
  });
});
