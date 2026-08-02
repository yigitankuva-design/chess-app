import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// vi.mock hoisted — import'lardan önce çalışır.
vi.mock('@/lib/imageCompress', () => ({
  compressImageToDataUri: vi.fn(async () => 'data:image/jpeg;base64,FAKE'),
}));

import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';
import { compressImageToDataUri } from '@/lib/imageCompress';

function makeImageFile(): File {
  return new File(['fake-image-bytes'], 'clip.png', { type: 'image/png' });
}

beforeEach(() => vi.mocked(compressImageToDataUri).mockClear());

describe('ChoiceExerciseFields — Ctrl+V ile görsel yapıştırma', () => {
  it('yapıştırılan resim mevcut görsel hattına yönlendirilir ve önizleme çıkar', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    const pasteZone = screen.getByText(/Ctrl\+V ile yapıştır/);

    const file = makeImageFile();
    fireEvent.paste(pasteZone, {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => file }] },
    });

    await waitFor(() => {
      expect(vi.mocked(compressImageToDataUri)).toHaveBeenCalledWith(file);
    });
    await waitFor(() => {
      const img = screen.getByAltText('Görsel 1') as HTMLImageElement;
      expect(img.src).toBe('data:image/jpeg;base64,FAKE');
    });
  });

  it('resim OLMAYAN veri yapıştırılırsa görsel hattı hiç çağrılmaz', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    const pasteZone = screen.getByText(/Ctrl\+V ile yapıştır/);
    fireEvent.paste(pasteZone, {
      clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] },
    });
    expect(vi.mocked(compressImageToDataUri)).not.toHaveBeenCalled();
    expect(screen.queryByAltText('Görsel 1')).not.toBeInTheDocument();
  });
});
