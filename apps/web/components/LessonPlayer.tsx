'use client';
import { useEffect, useState } from 'react';
import { useLessonStore, LessonStep } from '@/lib/stores/lesson-store';
import { ExplanationStep } from './lesson-steps/ExplanationStep';
import { InlineExerciseStep } from './lesson-steps/InlineExerciseStep';

interface Props {
  lessonId: number;
  initialSteps: LessonStep[];
  onComplete: () => void;
}

export function LessonPlayer({ lessonId, initialSteps, onComplete }: Props) {
  const { steps, currentStepIndex, setLesson, advance } = useLessonStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setLesson(lessonId, initialSteps);
    setInitialized(true);
  }, [lessonId, initialSteps, setLesson]);

  if (!initialized || steps.length === 0) {
    return <div className="p-8 text-center">Yükleniyor...</div>;
  }

  if (currentStepIndex >= steps.length) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold">Dersi tamamladın!</h2>
        <button
          onClick={onComplete}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg"
        >
          Devam et
        </button>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-4 bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm opacity-75 mb-6">
        Adım {currentStepIndex + 1} / {steps.length}
      </p>

      {currentStep.type === 'explanation' && (
        <ExplanationStep
          content={currentStep.content_json as never}
          onContinue={advance}
        />
      )}
      {currentStep.type === 'inline_exercise' && (
        <InlineExerciseStep
          stepId={currentStep.id}
          lessonId={lessonId}
          content={currentStep.content_json as never}
          onContinue={advance}
        />
      )}
    </div>
  );
}
