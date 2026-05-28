'use client';
import { useEffect, useState } from 'react';
import { useLessonStore, LessonStep } from '@/lib/stores/lesson-store';
import { ExplanationStep } from './lesson-steps/ExplanationStep';
import { InlineExerciseStep } from './lesson-steps/InlineExerciseStep';
import { ModuleQuiz } from './ModuleQuiz';

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
    return (
      <div className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-3 rounded-full" />
        <div className="t-skel h-40 rounded-xl" />
        <div className="t-skel h-32 rounded-xl" />
      </div>
    );
  }

  if (currentStepIndex >= steps.length) {
    return (
      <div className="px-4 pt-12 pb-12 max-w-2xl mx-auto text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold">Dersi tamamladın!</h2>
        <button onClick={onComplete} className="t-btn px-6 py-3">
          Devam et
        </button>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="flex items-center gap-3 py-3">
        <div className="flex-1 t-prog-track">
          <div
            className="t-prog-fill transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs t-muted flex-shrink-0">
          {currentStepIndex + 1} / {steps.length}
        </span>
      </div>

      <div className="pb-8">
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
        {currentStep.type === 'quiz' && (
          <ModuleQuiz
            questions={(currentStep.content_json as { questions: Array<{ prompt: string; options: string[]; correct_index: number }> }).questions}
            onComplete={(_score, _max) => advance()}
          />
        )}
      </div>
    </div>
  );
}
