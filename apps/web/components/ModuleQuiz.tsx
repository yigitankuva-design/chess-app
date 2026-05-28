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
      <div className="space-y-6">
        <div className="text-center p-6 bg-blue-50 rounded-xl">
          <div className="text-5xl mb-3">{score === questions.length ? '🏆' : score >= questions.length / 2 ? '⭐' : '📚'}</div>
          <h2 className="text-2xl font-bold mb-2">Sınav Bitti!</h2>
          <p className="text-lg">{questions.length} sorudan <strong>{score}</strong> doğru</p>
        </div>
        {questions.map((q, i) => (
          <div key={i} className={`p-4 rounded-lg border-2 ${answers[i] === q.correct_index ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <p className="font-medium mb-2">Soru {i + 1}: {q.prompt}</p>
            {q.options.map((opt, oi) => (
              <p key={oi} className={`text-sm py-1 px-2 rounded ${oi === q.correct_index ? 'text-green-700 font-bold' : oi === answers[i] ? 'text-red-600' : ''}`}>
                {oi === q.correct_index ? '✓ ' : oi === answers[i] ? '✗ ' : '  '}{opt}
              </p>
            ))}
          </div>
        ))}
        <button
          onClick={() => onComplete(score, questions.length)}
          className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-medium"
        >
          Devam et
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Modül Sınavı</h2>
      {questions.map((q, i) => (
        <div key={i} className="p-4 bg-white rounded-lg shadow">
          <p className="font-medium mb-3">Soru {i + 1}: {q.prompt}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => answer(i, oi)}
                className={`block w-full text-left p-3 rounded border transition-colors ${
                  answers[i] === oi
                    ? 'bg-blue-200 border-blue-500'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
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
        className="w-full bg-green-600 disabled:opacity-50 text-white py-3 rounded-lg text-lg font-medium"
      >
        {allAnswered ? 'Sınavı Bitir' : `Kalan soru: ${answers.filter(a => a === -1).length}`}
      </button>
    </div>
  );
}
