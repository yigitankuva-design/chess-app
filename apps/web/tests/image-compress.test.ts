import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImageToDataUri } from '@/lib/imageCompress';

class FakeImage {
  width = 1600;
  height = 1200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) {
    // Gerçek tarayıcı yüklemesini simüle et — mikro görev kuyruğunda onload çağır.
    queueMicrotask(() => this.onload?.());
  }
}

describe('compressImageToDataUri', () => {
  const originalImage = global.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  let toDataURLCalls: number[] = [];

  beforeEach(() => {
    toDataURLCalls = [];
    // @ts-expect-error test ortamında Image'i sahteleriz
    global.Image = FakeImage;
    URL.createObjectURL = vi.fn(() => 'blob:fake');

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    let call = 0;
    HTMLCanvasElement.prototype.toDataURL = vi.fn((_type?: string, quality?: number) => {
      call += 1;
      toDataURLCalls.push(quality ?? -1);
      // İlk çağrı büyük (limiti aşar), sonraki çağrılar küçülür.
      const size = call === 1 ? 500_000 : 100_000;
      return 'data:image/jpeg;base64,' + 'A'.repeat(size);
    }) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
  });

  afterEach(() => {
    global.Image = originalImage;
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('ilk deneme limiti aşarsa kaliteyi düşürüp tekrar dener', async () => {
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
    const result = await compressImageToDataUri(file, 400_000);
    expect(result.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(toDataURLCalls.length).toBeGreaterThan(1);
  });

  it('hiçbir kalite seviyesi limite sığmazsa hata fırlatır', async () => {
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => 'data:image/jpeg;base64,' + 'A'.repeat(999_999),
    ) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
    await expect(compressImageToDataUri(file, 400_000)).rejects.toThrow();
  });

  describe('format: "png" (madde 2026-09-19, ikon şeffaflığı)', () => {
    it('PNG kayıpsız olduğu için kalite yerine kenar uzunluğunu küçülterek dener', async () => {
      const widths: number[] = [];
      let call = 0;
      HTMLCanvasElement.prototype.toDataURL = vi.fn(function (this: HTMLCanvasElement, type?: string) {
        call += 1;
        widths.push(this.width);
        expect(type).toBe('image/png');
        const size = call === 1 ? 200_000 : 50_000;
        return 'data:image/png;base64,' + 'A'.repeat(size);
      }) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;

      const file = new File(['x'], 'icon.png', { type: 'image/png' });
      const result = await compressImageToDataUri(file, 100_000, 240, 'png');

      expect(result.startsWith('data:image/png;base64,')).toBe(true);
      expect(widths.length).toBeGreaterThan(1);
      // İkinci deneme daha küçük kenar uzunluğuyla çizilmiş olmalı.
      expect(widths[1]).toBeLessThan(widths[0]);
    });

    it('6 denemede de sığmazsa hata fırlatır (JPEG kalite düşürme YOK)', async () => {
      HTMLCanvasElement.prototype.toDataURL = vi.fn(
        () => 'data:image/png;base64,' + 'A'.repeat(999_999),
      ) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
      const file = new File(['x'], 'icon.png', { type: 'image/png' });
      await expect(compressImageToDataUri(file, 100_000, 240, 'png')).rejects.toThrow();
    });
  });
});
