import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { SentenceQuestionEx } from '@/components/lesson-steps/BoardExercise';

const EX: SentenceQuestionEx = {
  type: 'sentence_question', instruction: 'Soru?', answer_kind: 'sentence',
  options: ['Yanlış', 'Doğru'], correct_index: 1,
};

describe('BoardExercise — yanlış cevap kalıcılığı (madde 6)', () => {
  it('noRetry modunda yanlış cevap sonrası "Sonraki Soruya Geç" 1.8sn sonra da EKRANDA KALIR', async () => {
    vi.useFakeTimers();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry />);
    fireEvent.click(screen.getByText('Yanlış'));
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
    vi.advanceTimersByTime(2000);
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('initialAnswer="wrong" ile mount edilince soru KİLİTLİ ve geribildirimli başlar', () => {
    const onAnswered = vi.fn();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry
      initialIndex={0} initialAnswer="wrong" onAnswered={onAnswered} />);
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
    expect(screen.getByText('Yanlış!')).toBeInTheDocument();
    // Kilitliyken şıklara tıklamak hiçbir şey değiştirmemeli (tekrar çözülemez).
    fireEvent.click(screen.getByText('Doğru'));
    expect(onAnswered).not.toHaveBeenCalled();
  });

  it('yanlış cevapta onAnswered(index, doneCount, "wrong") çağrılır', () => {
    const onAnswered = vi.fn();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry
      onAnswered={onAnswered} />);
    fireEvent.click(screen.getByText('Yanlış'));
    expect(onAnswered).toHaveBeenCalledWith(0, 0, 'wrong');
  });

  it('doğru cevapta onAnswered(index, doneCount, "correct") çağrılır', () => {
    const onAnswered = vi.fn();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry
      onAnswered={onAnswered} />);
    fireEvent.click(screen.getByText('Doğru'));
    expect(onAnswered).toHaveBeenCalledWith(0, 1, 'correct');
  });

  it('initialDoneCount restore edilince ilerleme ikinci kez sayılmaz', () => {
    const onAnswered = vi.fn();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry
      initialIndex={1} initialDoneCount={1} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByText('Doğru'));
    expect(onAnswered).toHaveBeenCalledWith(1, 2, 'correct');
  });
});
