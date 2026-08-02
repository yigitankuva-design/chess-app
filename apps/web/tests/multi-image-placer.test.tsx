import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiImagePlacer } from '@/components/admin/MultiImagePlacer';
import { DEFAULT_PLACEMENT } from '@/lib/chess/imagePlacement';

const IMG1 = { uri: 'data:image/png;base64,AAA', ...DEFAULT_PLACEMENT };
const IMG2 = { uri: 'data:image/png;base64,BBB', x: 30, y: 30, w: 20, h: 20, tone: 0 };

describe('MultiImagePlacer', () => {
  it('birden fazla görseli aynı anda render eder', () => {
    render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={vi.fn()} />);
    expect(screen.getByAltText('Görsel 1')).toBeInTheDocument();
    expect(screen.getByAltText('Görsel 2')).toBeInTheDocument();
  });

  it('görsele tıklamak onu seçer, ton kaydırıcısını gösterir', () => {
    render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Görsel ton ayarı')).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByAltText('Görsel 1'), { clientX: 0, clientY: 0 });
    expect(screen.getByLabelText('Görsel ton ayarı')).toBeInTheDocument();
  });

  it('seçili görseli sürüklemek onChange ile SADECE o görselin konumunu değiştirir', () => {
    const onChange = vi.fn();
    const { container } = render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={onChange} />);
    const boardWrap = container.querySelector('[data-drag-root]') as HTMLElement;
    boardWrap.getBoundingClientRect = () => ({
      width: 200, height: 200, left: 0, top: 0, right: 200, bottom: 200, x: 0, y: 0, toJSON() {},
    });
    fireEvent.pointerDown(screen.getByAltText('Görsel 1'), { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(boardWrap, { clientX: 120, clientY: 100 });
    const next = onChange.mock.calls[0][0];
    expect(next[0].x).toBe(60);
    expect(next[1]).toEqual(IMG2);
  });

  it('seçili görseli sil butonu diziden çıkarır', () => {
    const onChange = vi.fn();
    render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByAltText('Görsel 2'), { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByText('Sil'));
    expect(onChange).toHaveBeenCalledWith([IMG1]);
  });

  it('ton kaydırıcısı sadece seçili görseli değiştirir', () => {
    const onChange = vi.fn();
    render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByAltText('Görsel 2'), { clientX: 0, clientY: 0 });
    fireEvent.change(screen.getByLabelText('Görsel ton ayarı'), { target: { value: '6' } });
    const next = onChange.mock.calls[0][0];
    expect(next[0]).toEqual(IMG1);
    expect(next[1].tone).toBe(6);
  });
});
