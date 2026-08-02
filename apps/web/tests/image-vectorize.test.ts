import { describe, it, expect, vi } from 'vitest';

vi.mock('imagetracerjs', () => ({
  default: {
    imageToSVG: vi.fn((_url: string, callback: (svg: string) => void) => {
      callback('<svg><path d="M0 0"/></svg>');
    }),
  },
}));

import { vectorizeImage } from '@/lib/imageVectorize';

describe('vectorizeImage', () => {
  it('imagetracerjs callback sonucunu base64 SVG data-URI olarak döner', async () => {
    const result = await vectorizeImage('data:image/png;base64,AAA');
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    const decoded = decodeURIComponent(escape(atob(result.split(',')[1])));
    expect(decoded).toBe('<svg><path d="M0 0"/></svg>');
  });
});
