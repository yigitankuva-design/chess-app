'use client';
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { PaintItemView } from '@/components/PaintItemView';
import {
  PALETTE, SHAPES, newTextItem, newShapeItem, dragItem, resizeItem, rotateItem,
} from '@/lib/chess/paintItems';
import type { PaintItem, ShapeKind } from '@/lib/chess/paintItems';

interface Props {
  items: PaintItem[];
  onChange: (items: PaintItem[]) => void;
  children: ReactNode;
}

type Tool = { kind: 'text' } | { kind: 'shape'; shape: ShapeKind } | null;
type DragMode = 'move' | 'resize' | 'rotate' | null;

export function PaintEditor({ items, onChange, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; item: PaintItem } | null>(null);
  const history = useRef<PaintItem[][]>([]);
  const [tool, setTool] = useState<Tool>(null);
  const [color, setColor] = useState(PALETTE[0].color);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<DragMode>(null);

  function pushHistory() {
    history.current = [...history.current, items].slice(-20);
  }

  function undo() {
    const prev = history.current.pop();
    if (prev) onChange(prev);
  }

  function onBoxPointerDown(e: ReactPointerEvent) {
    if (mode) return;
    if (!tool || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    pushHistory();
    const item = tool.kind === 'text' ? newTextItem(x, y, color) : newShapeItem(tool.shape, x, y, color);
    onChange([...items, item]);
    setSelected(item.id);
    setTool(null);
  }

  function startDrag(e: ReactPointerEvent, id: string, m: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    const item = items.find((it) => it.id === id);
    if (!item) return;
    pushHistory();
    setSelected(id);
    dragStart.current = { x: e.clientX, y: e.clientY, item };
    setMode(m);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!mode || !selected || !dragStart.current || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const start = dragStart.current.item;
    let next: PaintItem = start;
    if (mode === 'move') {
      next = dragItem(start, e.clientX - dragStart.current.x, e.clientY - dragStart.current.y, rect.width, rect.height);
    } else if (mode === 'resize' && start.kind === 'shape') {
      next = resizeItem(start, e.clientX - dragStart.current.x, e.clientY - dragStart.current.y, rect.width, rect.height);
    } else if (mode === 'rotate') {
      const centerPxX = rect.left + (start.x / 100) * rect.width;
      const centerPxY = rect.top + (start.y / 100) * rect.height;
      next = rotateItem(start, centerPxX, centerPxY, e.clientX, e.clientY);
    }
    onChange(items.map((it) => (it.id === selected ? next : it)));
  }

  function endDrag() {
    setMode(null);
    dragStart.current = null;
  }

  function removeSelected() {
    if (!selected) return;
    pushHistory();
    onChange(items.filter((it) => it.id !== selected));
    setSelected(null);
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  }

  const sel = items.find((it) => it.id === selected) ?? null;

  return (
    <div className="flex gap-3" onKeyDown={onKeyDown} tabIndex={0}>
      <div
        ref={boxRef}
        data-testid="paint-board-box"
        onPointerDown={onBoxPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ position: 'relative', maxWidth: 240 }}
      >
        {children}
        {items.map((item) => (
          <PaintItemView key={item.id} item={item} selected={item.id === selected}
            onPointerDown={(e) => startDrag(e, item.id, 'move')} />
        ))}
        {sel && sel.kind === 'shape' && (
          <div role="button" aria-label="Boyutlandır" onPointerDown={(e) => startDrag(e, sel.id, 'resize')}
            style={{
              position: 'absolute', left: `${sel.x + sel.w / 2}%`, top: `${sel.y + sel.h / 2}%`,
              width: 14, height: 14, transform: 'translate(-50%,-50%)',
              background: '#22d3ee', borderRadius: 4, border: '2px solid white',
            }} />
        )}
        {sel && (
          <div role="button" aria-label="Döndür" onPointerDown={(e) => startDrag(e, sel.id, 'rotate')}
            style={{
              position: 'absolute', left: `${sel.x}%`, top: `${Math.max(sel.y - 15, 2)}%`,
              width: 12, height: 12, transform: 'translate(-50%,-50%)',
              background: '#facc15', borderRadius: '50%', border: '2px solid white',
            }} />
        )}
      </div>
      <div className="space-y-2" style={{ minWidth: 140 }}>
        <p className="text-xs n-muted">Yazı-Şekil-Renk Ekle (opsiyonel)</p>
        <button type="button" onClick={() => setTool({ kind: 'text' })}
          className={`px-2 py-1 rounded text-xs border block ${tool?.kind === 'text' ? 'border-cyan-400 text-cyan-200' : 'border-white/15 text-white/70'}`}>
          Yazı
        </button>
        <div className="flex flex-wrap gap-1">
          {SHAPES.map((s) => (
            <button key={s.shape} type="button" onClick={() => setTool({ kind: 'shape', shape: s.shape })}
              className={`px-2 py-1 rounded text-xs border ${tool?.kind === 'shape' && tool.shape === s.shape ? 'border-cyan-400 text-cyan-200' : 'border-white/15 text-white/70'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {PALETTE.map((p) => (
            <button key={p.color} type="button" aria-label={p.name} onClick={() => setColor(p.color)}
              style={{ width: 20, height: 20, background: p.color, border: color === p.color ? '2px solid #22d3ee' : '1px solid #ffffff40', borderRadius: 4 }} />
          ))}
        </div>
        {sel && (
          <div className="space-y-1">
            {sel.kind === 'text' && (
              <>
                <input value={sel.text} aria-label="Yazı metni"
                  onChange={(e) => onChange(items.map((it) => (it.id === sel.id ? { ...it, text: e.target.value } : it)))}
                  className="neon-input text-xs" />
                <input type="range" min={12} max={72} value={sel.fontSize} aria-label="Punto"
                  onChange={(e) => onChange(items.map((it) => (it.id === sel.id ? { ...it, fontSize: Number(e.target.value) } : it)))} />
              </>
            )}
            <button type="button" onClick={removeSelected}
              className="px-2 py-1 rounded text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40">
              Sil
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
