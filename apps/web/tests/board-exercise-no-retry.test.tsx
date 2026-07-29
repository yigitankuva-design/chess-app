import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

/** Secenekli iki soru — tahta gerektirmez, jsdom'da guvenle surulur. */
const IKI_SORU: BoardExerciseConfig[] = [
  {
    type: 'sentence_question',
    prompt: 'Şah kaç kare gider?',
    options: ['Bir', 'İki'],
    correct_index: 0,
    fail_msg: 'Yanlış!',
  },
  {
    type: 'sentence_question',
    prompt: 'At nasıl gider?',
    options: ['L', 'Düz'],
    correct_index: 0,
    fail_msg: 'Yanlış!',
  },
] as unknown as BoardExerciseConfig[];

describe('BoardExercise — noRetry (madde 1: Süresiz Pratik)', () => {
  it('yanlış cevaptan sonra "Sonraki Soruya Geç" çıkar', () => {
    render(<BoardExercise exercises={IKI_SORU} done={false} onCorrect={vi.fn()} noRetry />);
    fireEvent.click(screen.getByText('İki'));          // yanlis
    expect(screen.getByText('Yanlış!')).toBeInTheDocument();
    expect(screen.getByText(/Sonraki Soruya Geç/)).toBeInTheDocument();
  });

  it('TUZAK: yanlış cevaptan sonra soru TEKRAR ÇÖZÜLEMEZ', () => {
    render(<BoardExercise exercises={IKI_SORU} done={false} onCorrect={vi.fn()} noRetry />);
    fireEvent.click(screen.getByText('İki'));          // yanlis
    fireEvent.click(screen.getByText('Bir'));          // dogruyu denemek
    // Hala yanlis geri bildirimi duruyor, "dogru" ekranina GECMEDI.
    expect(screen.getByText('Yanlış!')).toBeInTheDocument();
    expect(screen.getByText(/Sonraki Soruya Geç/)).toBeInTheDocument();
  });

  it('geç butonuna basınca sonraki soru gelir ve kilit açılır', () => {
    render(<BoardExercise exercises={IKI_SORU} done={false} onCorrect={vi.fn()} noRetry />);
    fireEvent.click(screen.getByText('İki'));
    fireEvent.click(screen.getByText(/Sonraki Soruya Geç/));
    // Soru METNI ust sayfada ciziliyor; bu bilesende secenekler degisir.
    expect(screen.getByText('Soru 2/2')).toBeInTheDocument();
    expect(screen.getByText('Düz')).toBeInTheDocument();
    expect(screen.queryByText('Yanlış!')).not.toBeInTheDocument();
  });

  it('son soru yanlışsa oturum biter ve doğru sayısı artmaz', () => {
    const onFinish = vi.fn();
    render(
      <BoardExercise exercises={IKI_SORU} done={false} onCorrect={vi.fn()}
        onFinish={onFinish} noRetry />,
    );
    fireEvent.click(screen.getByText('Bir'));                    // 1. dogru
    fireEvent.click(screen.getByText(/Sonraki Soru/));
    fireEvent.click(screen.getByText('Düz'));                    // 2. yanlis
    expect(onFinish).toHaveBeenCalledWith({ correct: 1, total: 2 });
  });

  it('noRetry KAPALIYKEN eski davranış korunur: tekrar denenebilir', () => {
    render(<BoardExercise exercises={IKI_SORU} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(screen.getByText('İki'));          // yanlis
    expect(screen.queryByText(/Sonraki Soruya Geç/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Bir'));          // dogruyu dene
    expect(screen.getByText(/Sonraki Soru/)).toBeInTheDocument();
  });
});
