import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaintEditor } from '@/components/admin/PaintEditor';
import type { PaintItem } from '@/lib/chess/paintItems';

function setup(items: PaintItem[] = []) {
  const onChange = vi.fn();
  const utils = render(
    <PaintEditor items={items} onChange={onChange}>
      <div style={{ width: 200, height: 200 }} data-testid="board-placeholder" />
    </PaintEditor>,
  );
  return { ...utils, onChange };
}

describe('PaintEditor', () => {
  it('araç panelinde yazı, 6 şekil ve 10 renk butonu vardır', () => {
    setup();
    expect(screen.getByText('Yazı')).toBeInTheDocument();
    expect(screen.getByText('Daire')).toBeInTheDocument();
    expect(screen.getByText('Ok')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Siyah|Beyaz|Kırmızı|Mavi|Yeşil|Mor|Turuncu|Turkuaz|Kahverengi|Sarı/ })).toHaveLength(10);
  });

  it('araç seçip tahtaya tıklayınca yeni öğe eklenir', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByText('Daire'));
    fireEvent.pointerDown(screen.getByTestId('paint-board-box'), { clientX: 50, clientY: 50 });
    expect(onChange).toHaveBeenCalled();
    const added = onChange.mock.calls[0][0];
    expect(added).toHaveLength(1);
    expect(added[0].kind).toBe('shape');
    expect(added[0].shape).toBe('circle');
  });

  it('araç seçili değilken tahtaya tıklamak öğe eklemez', () => {
    const { onChange } = setup();
    fireEvent.pointerDown(screen.getByTestId('paint-board-box'), { clientX: 50, clientY: 50 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('seçili öğe için Sil butonu öğeyi kaldırır', () => {
    const item: PaintItem = { id: 'x1', kind: 'shape', shape: 'circle', x: 50, y: 50, w: 15, h: 15, rotation: 0, color: '#000000' };
    const { onChange } = setup([item]);
    fireEvent.pointerDown(screen.getByTestId('paint-item-x1'));
    fireEvent.click(screen.getByText('Sil'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('Ctrl+Z bir önceki duruma döner', () => {
    const item: PaintItem = { id: 'x1', kind: 'shape', shape: 'circle', x: 50, y: 50, w: 15, h: 15, rotation: 0, color: '#000000' };
    const { onChange, container } = setup([item]);
    fireEvent.pointerDown(screen.getByTestId('paint-item-x1'));
    fireEvent.click(screen.getByText('Sil'));
    fireEvent.keyDown(container.firstChild as Element, { key: 'z', ctrlKey: true });
    expect(onChange).toHaveBeenLastCalledWith([item]);
  });
});
