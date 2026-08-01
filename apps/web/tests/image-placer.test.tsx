import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImagePlacer } from '@/components/admin/ImagePlacer';
import { DEFAULT_PLACEMENT } from '@/lib/chess/imagePlacement';

describe('ImagePlacer', () => {
  it('görseli varsayılan konum/boyut/ton ile render eder', () => {
    render(<ImagePlacer uri="data:image/png;base64,AAA" placement={DEFAULT_PLACEMENT} onChange={vi.fn()} />);
    const img = screen.getByAltText('Konumlandırılan görsel') as HTMLImageElement;
    expect(img.style.left).toBe('50%');
    expect(img.style.top).toBe('50%');
    expect(img.style.width).toBe('40%');
    expect(img.style.height).toBe('40%');
    expect(img.style.filter).toBe('none');
  });

  it('ton kaydırıcısı değişince onChange doğru ton ile çağrılır', () => {
    const onChange = vi.fn();
    render(<ImagePlacer uri="x" placement={DEFAULT_PLACEMENT} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Görsel ton ayarı'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_PLACEMENT, tone: 7 });
  });

  it('görseli sürüklemek onChange ile yeni x/y tetikler', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ImagePlacer uri="x" placement={DEFAULT_PLACEMENT} onChange={onChange} />,
    );
    const boardWrap = container.querySelector('[data-drag-root]') as HTMLElement;
    boardWrap.getBoundingClientRect = () => ({
      width: 200, height: 200, left: 0, top: 0, right: 200, bottom: 200, x: 0, y: 0, toJSON() {},
    });
    const img = screen.getByAltText('Konumlandırılan görsel');
    fireEvent.pointerDown(img, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(boardWrap, { clientX: 120, clientY: 100 });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ x: 60, y: 50 }));
  });

  it('boyutlandırma tutamacını sürüklemek onChange ile yeni w/h tetikler', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ImagePlacer uri="x" placement={DEFAULT_PLACEMENT} onChange={onChange} />,
    );
    const boardWrap = container.querySelector('[data-drag-root]') as HTMLElement;
    boardWrap.getBoundingClientRect = () => ({
      width: 200, height: 200, left: 0, top: 0, right: 200, bottom: 200, x: 0, y: 0, toJSON() {},
    });
    const handle = screen.getByLabelText('Boyutlandır');
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(boardWrap, { clientX: 120, clientY: 100 });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ w: 60 }));
  });
});
