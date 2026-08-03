import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PaintItemView } from '@/components/PaintItemView';
import type { TextPaintItem, ShapePaintItem } from '@/lib/chess/paintItems';

const TEXT: TextPaintItem = { id: 't1', kind: 'text', x: 50, y: 50, rotation: 0, color: '#ef4444', text: 'Merhaba', fontSize: 30 };
const CIRCLE: ShapePaintItem = { id: 's1', kind: 'shape', shape: 'circle', x: 20, y: 30, w: 10, h: 10, rotation: 45, color: '#3b82f6' };
const ARROW: ShapePaintItem = { id: 's2', kind: 'shape', shape: 'arrow', x: 40, y: 40, w: 20, h: 10, rotation: 0, color: '#22c55e' };
const QMARK: ShapePaintItem = { id: 's3', kind: 'shape', shape: 'question', x: 60, y: 60, w: 15, h: 15, rotation: 0, color: '#000000' };

describe('PaintItemView', () => {
  it('metin öğesini doğru renk/punto/metinle render eder', () => {
    const { getByTestId } = render(<PaintItemView item={TEXT} />);
    const el = getByTestId('paint-item-t1');
    expect(el.textContent).toBe('Merhaba');
    expect(el.style.color).toBe('#ef4444');
    expect(el.style.fontSize).toBe('30px');
  });

  it('daire öğesi border-radius ve döndürme uygular', () => {
    const { getByTestId } = render(<PaintItemView item={CIRCLE} />);
    const el = getByTestId('paint-item-s1');
    expect(el.style.borderRadius).toBe('50%');
    expect(el.style.transform).toContain('rotate(45deg)');
  });

  it('ok şekli svg olarak render edilir', () => {
    const { getByTestId } = render(<PaintItemView item={ARROW} />);
    expect(getByTestId('paint-item-s2').tagName).toBe('svg');
  });

  it('soru işareti "?" karakteri render eder', () => {
    const { getByTestId } = render(<PaintItemView item={QMARK} />);
    expect(getByTestId('paint-item-s3').textContent).toBe('?');
  });

  it('onPointerDown verilirse tıklanabilir olur (etkileşimli mod)', () => {
    const onPointerDown = vi.fn();
    const { getByTestId } = render(<PaintItemView item={TEXT} onPointerDown={onPointerDown} />);
    expect(getByTestId('paint-item-t1').style.cursor).toBe('move');
  });
});
