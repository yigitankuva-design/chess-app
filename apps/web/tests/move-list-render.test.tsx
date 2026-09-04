import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoveList } from '@/components/play/MoveList';

/** Her hamle-çifti satırı ayrı bir grid hücresidir (madde 2026-09-06/4) —
 *  satır satır metni okur, boşlukları normalize eder. */
function rows(): string[] {
  return Array.from(screen.getByLabelText('Hamleler').querySelectorAll('.whitespace-nowrap'))
    .map((el) => el.textContent!.replace(/\s+/g, ' ').trim());
}

describe('MoveList — tahta altındaki notasyon (madde 1/3)', () => {
  it('hamle yokken bilgilendirir', () => {
    render(<MoveList san={[]} />);
    expect(screen.getByText('Henüz hamle yapılmadı.')).toBeInTheDocument();
  });

  it('hamleler numaralı satırlar halinde ve TÜRKÇE yazılır', () => {
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']} />);
    expect(rows()).toEqual(['1.e4-e5', '2.Af3-Ac6', '3.Fc4-Fc5']);
  });

  it('tek hamlede tire yazılmaz', () => {
    render(<MoveList san={['e4']} />);
    expect(rows()).toEqual(['1.e4']);
  });

  it('açılış konumundan başlayan maçta numara FEN’den devam eder', () => {
    render(
      <MoveList
        san={['Nf6']}
        startFen="r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 3"
      />,
    );
    expect(rows()).toEqual(['3.…-Af6']);
  });

  it('notasyon kartı tahtayla aynı genişlikte sınırlanır', () => {
    render(<MoveList san={['e4']} />);
    expect(screen.getByLabelText('Hamleler').className).toContain('max-w-[600px]');
  });

  it('madde 2026-09-06 (üçüncü tur/5): kart çerçevesi tema uyumlu (var(--t-accent))', () => {
    render(<MoveList san={['e4']} />);
    expect(screen.getByLabelText('Hamleler').style.borderColor).toBe('var(--t-accent)');
  });
});

describe('MoveList — madde 2026-09-06 (4): her satırda SABİT 3 hamle çifti', () => {
  it('7 hamle çifti (14 yarı-hamle) 3 satıra bölünür — 3 sütunlu sabit grid', () => {
    const san = Array.from({ length: 14 }, (_, i) => (i % 2 === 0 ? 'e4' : 'e5'));
    render(<MoveList san={san} />);
    // 7 çift veri var ama görsel bölünme artık içerik uzunluğuna değil,
    // CSS grid'e (repeat(3, 1fr)) bağlı — her satır kendi hücresinde durur.
    expect(rows()).toHaveLength(7);
    const grid = screen.getByLabelText('Hamleler').querySelector('.grid') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('her hamle çifti kendi hücresinde kalır, aralarında virgül YOKTUR', () => {
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6']} />);
    expect(rows()).toEqual(['1.e4-e5', '2.Af3-Ac6']);
    expect(screen.getByLabelText('Hamleler').textContent).not.toContain(',');
  });
});
