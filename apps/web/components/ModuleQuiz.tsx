'use client';
import { useState } from 'react';

interface Question {
  prompt: string;
  options: string[];
  correct_index: number;
}

interface Props {
  questions: Question[];
  onComplete: (score: number, max: number) => void;
}

export function ModuleQuiz({ questions, onComplete }: Props) {
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  function answer(qIdx: number, optIdx: number) {
    if (submitted) return;
    const next = [...answers];
    next[qIdx] = optIdx;
    setAnswers(next);
  }

  function submit() {
    const s = questions.reduce((acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0), 0);
    setScore(s);
    setSubmitted(true);
  }

  const allAnswered = answers.every(a => a !== -1);

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="t-ok p-5 text-center">
          <div className="text-5xl mb-3">
            {score === questions.length ? '🏆' : score >= questions.length / 2 ? '⭐' : '📚'}
          </div>
          <h2 className="text-xl font-bold mb-1">Sınav Bitti!</h2>
          <p className="t-muted text-sm">{questions.length} sorudan <strong>{score}</strong> doğru</p>
        </div>
        {questions.map((q, i) => {
          const correct = answers[i] === q.correct_index;
          return (
            <div
              key={i}
              className={correct ? 't-ok p-4' : 't-err p-4'}
            >
              <p className="font-medium text-sm mb-2">Soru {i + 1}: {q.prompt}</p>
              {q.options.map((opt, oi) => (
                <p
                  key={oi}
                  className={[
                    'text-xs py-0.5 px-1 rounded',
                    oi === q.correct_index ? 'font-bold t-ac' : oi === answers[i] ? 'opacity-60 line-through' : 'opacity-50',
                  ].join(' ')}
                >
                  {oi === q.correct_index ? '✓ ' : oi === answers[i] ? '✗ ' : '  '}{opt}
                </p>
              ))}
            </div>
          );
        })}
        <button
          onClick={() => onComplete(score, questions.length)}
          className="t-btn w-full py-3 text-base font-medium"
        >
          Devam et
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Modül Sınavı</h2>
      {questions.map((q, i) => (
        <div key={i} className="t-card p-4">
          <p className="font-semibold text-sm mb-3">Soru {i + 1}: {q.prompt}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => answer(i, oi)}
                className={[
                  't-card-i w-full text-left px-3 py-2.5 text-sm transition-all',
                  answers[i] === oi ? 'ring-2' : '',
                ].join(' ')}
                style={answers[i] === oi ? { '--tw-ring-color': 'var(--t-accent)' } as React.CSSProperties : {}}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={submit}
        disabled={!allAnswered}
        className="t-btn w-full py-3 text-base font-medium disabled:opacity-50"
      >
        {allAnswered ? 'Sınavı Bitir' : `Kalan soru: ${answers.filter(a => a === -1).length}`}
      </button>
    </div>
  );
}
