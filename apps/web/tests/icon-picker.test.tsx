import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconPicker } from '@/components/admin/IconPicker';

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
