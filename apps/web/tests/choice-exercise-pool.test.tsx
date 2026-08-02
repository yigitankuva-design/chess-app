import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchPoolImages = vi.fn();
const addPoolImage = vi.fn();
vi.mock('@/lib/admin/poolApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/poolApi')>(
    '@/lib/admin/poolApi',
  );
  return {
    ...actual,
    fetchPoolImages: (c: string) => fetchPoolImages(c),
    addPoolImage: (c: string, d: string) => addPoolImage(c, d),
  };
});

import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

const POOL_IMG = 'data:image/png;base64,POOL';

beforeEach(() => {
  fetchPoolImages.mockReset();
  addPoolImage.mockReset();
  fetchPoolImages.mockResolvedValue([{ id: 1, category: 'Hayvanlar', data_uri: POOL_IMG }]);
  addPoolImage.mockResolvedValue(true);
});

/** Görüntü sorusu + cevap tipi Görüntü — tüm görsel seçim noktalarını açar. */
function renderImageQuestion() {
  render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Görüntü' }));
}

describe('ChoiceExerciseFields — soru görseli için iki kaynak', () => {
  it('Bilgisayardan Seç ve Havuzdan Seç birlikte gösterilir', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.getByText('Bilgisayardan Seç')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Havuzdan Seç' })).toBeInTheDocument();
  });

  it('REGRESYON: eski dosya girişi hâlâ var (Bilgisayardan Seç onu tetikler)', () => {
    const { container } = render(
      <ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />,
    );
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });

  it('Havuzdan Seç panel açar, çoklu seçim soru görselini tahtaya ekler', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Havuzdan Seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    fireEvent.click(await screen.findByLabelText('Hayvanlar havuz görseli'));
    fireEvent.click(screen.getByText('Seçilenleri Ekle (1)'));
    await waitFor(() => {
      const placed = screen.getByAltText('Görsel 1') as HTMLImageElement;
      expect(placed.src).toBe(POOL_IMG);
    });
  });

  it('"Seçilenleri Ekle" sonrası panel kapanır', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Havuzdan Seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    fireEvent.click(await screen.findByLabelText('Hayvanlar havuz görseli'));
    fireEvent.click(screen.getByText('Seçilenleri Ekle (1)'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Kapat' })).not.toBeInTheDocument(),
    );
  });
});

describe('ChoiceExerciseFields — şık görselleri için iki kaynak', () => {
  it('her şık için Havuzdan Seç düğmesi vardır', () => {
    renderImageQuestion();
    // 1 soru görseli + 2 şık = 3 adet
    expect(screen.getAllByRole('button', { name: 'Havuzdan Seç' })).toHaveLength(3);
  });

  it('bir şık için havuzdan seçim o şıkkın görselini doldurur', async () => {
    renderImageQuestion();
    const buttons = screen.getAllByRole('button', { name: 'Havuzdan Seç' });
    fireEvent.click(buttons[1]); // 1. şık
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('img')[0]);
    await waitFor(() => {
      const preview = screen.getByAltText('1. şık önizleme') as HTMLImageElement;
      expect(preview.src).toBe(POOL_IMG);
    });
  });

  it('AYNI ANDA TEK PANEL: ikinci Havuzdan Seç ilkini kapatır', async () => {
    renderImageQuestion();
    const buttons = screen.getAllByRole('button', { name: 'Havuzdan Seç' });
    fireEvent.click(buttons[1]);
    expect(screen.getAllByRole('button', { name: 'Kapat' })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Havuzdan Seç' })[2]);
    expect(screen.getAllByRole('button', { name: 'Kapat' })).toHaveLength(1);
  });
});

describe('ChoiceExerciseFields — havuza da ekle satırı', () => {
  /**
   * Dosya yükleme akışı canvas/Image gerektirdiği için happy-dom'da gerçekten
   * çalışmıyor; bunun yerine havuzdan seçim yapılır — her iki yol da aynı
   * `promptImage` state'ini doldurur, satırın görünme koşulu odur.
   */
  /**
   * Dosya yükleme akışı canvas/Image gerektirdiği için happy-dom'da gerçekten
   * çalışmıyor; bunun yerine havuzdan seçim yapılır. Soru görseli akışı artık
   * ÇOKLU seçim: görsele tıkla (sepete ekler), sonra "Seçilenleri Ekle".
   */
  async function pickFromPool() {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Havuzdan Seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    fireEvent.click(await screen.findByLabelText('Hayvanlar havuz görseli'));
    fireEvent.click(screen.getByText('Seçilenleri Ekle (1)'));
    await waitFor(() => expect(screen.getByAltText('Görsel 1')).toBeInTheDocument());
  }

  it('görsel yokken satır görünmez', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.queryByText(/Havuza da eklensin mi/i)).not.toBeInTheDocument();
  });

  it('görsel seçilince satır görünür', async () => {
    await pickFromPool();
    expect(screen.getByText(/Havuza da eklensin mi/i)).toBeInTheDocument();
  });

  it('kategori seçilmeden Havuza Ekle düğmesi kapalıdır', async () => {
    await pickFromPool();
    expect(screen.getByRole('button', { name: 'Havuza Ekle' })).toBeDisabled();
  });

  it('kategori seçilince düğme açılır', async () => {
    await pickFromPool();
    fireEvent.change(screen.getByLabelText('Havuz kategorisi'), {
      target: { value: 'Bitkiler' },
    });
    expect(screen.getByRole('button', { name: 'Havuza Ekle' })).toBeEnabled();
  });

  it('Havuza Ekle doğru kategori ve görselle addPoolImage çağırır', async () => {
    await pickFromPool();
    fireEvent.change(screen.getByLabelText('Havuz kategorisi'), {
      target: { value: 'Bitkiler' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Havuza Ekle' }));
    await waitFor(() => expect(addPoolImage).toHaveBeenCalledWith('Bitkiler', POOL_IMG));
  });

  it('başarıda onay mesajı gösterir', async () => {
    addPoolImage.mockResolvedValue(true);
    await pickFromPool();
    fireEvent.change(screen.getByLabelText('Havuz kategorisi'), {
      target: { value: 'Bitkiler' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Havuza Ekle' }));
    await waitFor(() => expect(screen.getByText(/havuza eklendi/i)).toBeInTheDocument());
  });

  it('başarısızlıkta hata mesajı gösterir', async () => {
    addPoolImage.mockResolvedValue(false);
    await pickFromPool();
    fireEvent.change(screen.getByLabelText('Havuz kategorisi'), {
      target: { value: 'Bitkiler' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Havuza Ekle' }));
    await waitFor(() => expect(screen.getByText(/eklenemedi/i)).toBeInTheDocument());
  });
});

describe('ChoiceExerciseFields — regresyon', () => {
  it('Cümle sorusunda görsel seçici hiç görünmez', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Havuzdan Seç' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Soru cümlesi/)).toBeInTheDocument();
  });

  it('cevap tipi Cümle iken şıklar metin girişi kalır', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    // varsayılan cevap tipi 'sentence'
    expect(screen.getByPlaceholderText('1. şık')).toBeInTheDocument();
    // yalnızca soru görseli için havuz düğmesi olmalı
    expect(screen.getAllByRole('button', { name: 'Havuzdan Seç' })).toHaveLength(1);
  });
});
