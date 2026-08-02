import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

describe('BoardExercise — P3 öncesi taban çizgisi (regresyon güvenlik ağı)', () => {
  it('move_piece: yanlış hamleden hemen sonra (fail penceresi içinde) tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'move_piece', instruction: "Piyonu e4'e taşı",
        fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', piece_square: 'e2', target_squares: ['e4'],
      },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e2"]')!);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış hedef
    expect(screen.getByText(/Yanlış kare/)).toBeInTheDocument();
    // Fail penceresi (1.8sn) DOLMADAN tekrar dene — taşı yeniden seçip doğru kareye taşıyabilmeli
    fireEvent.click(container.querySelector('[data-square="e2"]')!);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('identify_piece: yanlış şıktan sonra tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'identify_piece', instruction: 'Bu taş ne?',
        fen: '8/8/8/8/4n3/8/8/8 b - - 0 1', highlight_square: 'e4',
        options: ['Piyon', 'At'], correct_index: 1,
      },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(screen.getByText('Piyon')); // yanlış
    expect(screen.getByText(/Yanlış/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('At')); // tekrar dene, doğru
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('sentence_question: yanlış cevaptan sonra tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'sentence_question', instruction: 'Atın hareketi?',
        answer_kind: 'sentence', options: ['L şeklinde', 'Düz'], correct_index: 0,
      },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(screen.getByText('Düz')); // yanlış
    fireEvent.click(screen.getByText('L şeklinde')); // tekrar dene, doğru
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('click_square: 3 sorunun TÜMÜ doğru cevaplanınca onCorrect tam bir kez çağrılır', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q3', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soruya Geç'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soruya Geç'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});

describe('BoardExercise — click_square yeni davranış: renklendirme + tekrar deneme yok', () => {
  it('doğru kareye tıklayınca kare YEŞİL HALKA alır, boyanmaz', () => {
    // react-chessboard, squareStyles[square]'i [data-square]'in KENDİSİNE değil,
    // onun doğrudan çocuğu olan içerik sarmalayıcı div'ine uyguluyor (kaynak
    // kodda doğrulandı: <div style={{width:'100%',height:'100%',...squareStyles[id]}}>).
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    const sq = container.querySelector('[data-square="e4"]') as HTMLElement;
    const overlay = sq.querySelector('div') as HTMLElement;
    // Kare BOYANMAZ; ortasına halka çizilir (kullanıcı kararı).
    expect(overlay.style.borderRadius).toBe('50%');
    expect(overlay.style.borderColor).toContain('22, 163, 74');
    expect(overlay.style.backgroundColor).toBe('');
  });

  it('yanlış kareye tıklayınca o kare KIRMIZI HALKA alır, boyanmaz', () => {
    // 2 soruluk dizi kullanılıyor — tek soruda yanlış cevap "son soru" sayılıp
    // allAttempted terminal ekranına geçer, tahta DOM'dan tamamen kalkar.
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'y', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    const sq = container.querySelector('[data-square="a1"]') as HTMLElement;
    const overlay = sq.querySelector('div') as HTMLElement;
    expect(overlay.style.borderRadius).toBe('50%');
    expect(overlay.style.borderColor).toContain('220, 38, 38');
    expect(overlay.style.backgroundColor).toBe('');
  });

  it('yanlış cevaptan 2 saniye sonra bile durum sıfırlanmaz (tekrar deneme yok)', async () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'y', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 2000)); // mevcut fail() 1.8sn'de idle'a dönerdi
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument(); // hâlâ orada — sıfırlanmadı
  });

  it('yanlış cevap sonrası tekrar tıklama hiçbir şeyi değiştirmez', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'y', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    fireEvent.click(container.querySelector('[data-square="e4"]')!); // tekrar dene — etkisiz olmalı
    expect(onCorrect).not.toHaveBeenCalled();
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
  });

  it("yanlış cevap doneCount'u artırmaz (ilerleme noktası yanlışı doğru saymaz)", () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'y', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(document.querySelector('[data-square="a1"]')!); // yanlış
    expect(screen.getByText('0/2')).toBeInTheDocument();
  });

  it('KİLİTLENME REGRESYONU: Q1 doğru, Q2 yanlış, Q3 doğru — Q3 sonrası buton görünmez, terminal ekran görünür', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'q2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'q3', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    // Q1 doğru
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    fireEvent.click(screen.getByText('Sonraki Soruya Geç'));
    // Q2 yanlış
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soruya Geç'));
    // Q3 doğru — SON SORU
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(screen.queryByText('Sonraki Soruya Geç')).not.toBeInTheDocument();
    expect(onCorrect).not.toHaveBeenCalled(); // hepsi doğru değildi (Q2 yanlıştı)
    expect(container.textContent).toMatch(/cevapland/i); // yerel "bitti" mesajı
  });

  it('son soru YANLIŞ cevaplanırsa terminal ekran görünür, onCorrect çağrılmaz', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // tek soru, yanlış
    expect(onCorrect).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/cevapland/i);
  });

  it('REGRESYON: move_piece hâlâ fail penceresinde hemen tekrar denenebiliyor (guard tipe özel)', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'move_piece', instruction: 'x',
        fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', piece_square: 'e2', target_squares: ['e4'],
      },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e2"]')!);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    fireEvent.click(container.querySelector('[data-square="e2"]')!); // hemen tekrar dene
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });
});

describe('BoardExercise — succeed() bitiş tespiti currentIdx tabanlı (Task 2)', () => {
  it('3 sorunun tümü DOĞRU cevaplanırsa onCorrect hâlâ tam bir kez çağrılır (refactor no-op doğrulaması)', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soruya Geç'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});
