'use client';
import type { CSSProperties, PointerEvent } from 'react';
import type { PaintItem, ShapePaintItem } from '@/lib/chess/paintItems';

interface Props {
  item: PaintItem;
  selected?: boolean;
  onPointerDown?: (e: PointerEvent) => void;
}

function outline(selected?: boolean): CSSProperties {
  return { outline: selected ? '2px dashed #22d3ee' : 'none', outlineOffset: 2 };
}

function shapeBoxStyle(item: ShapePaintItem): CSSProperties {
  return {
    position: 'absolute',
    left: `${item.x}%`,
    top: `${item.y}%`,
    width: `${item.w}%`,
    height: `${item.h}%`,
    transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
  };
}

export function PaintItemView({ item, selected, onPointerDown }: Props) {
  const cursor = onPointerDown ? 'move' : 'default';

  if (item.kind === 'text') {
    return (
      <span
        data-testid={`paint-item-${item.id}`}
        onPointerDown={onPointerDown}
        style={{
          position: 'absolute',
          left: `${item.x}%`,
          top: `${item.y}%`,
          transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
          color: item.color,
          fontSize: item.fontSize,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          cursor,
          ...outline(selected),
        }}
      >
        {item.text}
      </span>
    );
  }

  if (item.shape === 'arrow') {
    return (
      <svg
        data-testid={`paint-item-${item.id}`}
        onPointerDown={onPointerDown}
        style={{ ...shapeBoxStyle(item), cursor, ...outline(selected) }}
        viewBox="0 0 100 100"
        fill={item.color}
      >
        <polygon points="10,55 60,55 60,35 90,50 60,65 60,55" />
      </svg>
    );
  }

  if (item.shape === 'question') {
    return (
      <span
        data-testid={`paint-item-${item.id}`}
        onPointerDown={onPointerDown}
        style={{
          ...shapeBoxStyle(item),
          color: item.color,
          fontWeight: 900,
          fontSize: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor,
          ...outline(selected),
        }}
      >
        ?
      </span>
    );
  }

  if (item.shape === 'star') {
    return (
      <div
        data-testid={`paint-item-${item.id}`}
        onPointerDown={onPointerDown}
        style={{
          ...shapeBoxStyle(item),
          background: item.color,
          clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
          cursor,
          ...outline(selected),
        }}
      />
    );
  }

  return (
    <div
      data-testid={`paint-item-${item.id}`}
      onPointerDown={onPointerDown}
      style={{
        ...shapeBoxStyle(item),
        borderRadius: item.shape === 'circle' ? '50%' : 0,
        border: `3px solid ${item.color}`,
        boxSizing: 'border-box',
        cursor,
        ...outline(selected),
      }}
    />
  );
}
