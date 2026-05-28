import { create } from 'zustand';

export interface LessonStep {
  id: number;
  order_index: number;
  type: 'explanation' | 'inline_exercise' | 'quiz';
  content_json: Record<string, unknown>;
}

interface LessonState {
  lessonId: number | null;
  steps: LessonStep[];
  currentStepIndex: number;
  startedAt: number;
  attempts: Record<number, number>;
  setLesson: (id: number, steps: LessonStep[]) => void;
  advance: () => void;
  recordAttempt: () => void;
  reset: () => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  lessonId: null,
  steps: [],
  currentStepIndex: 0,
  startedAt: 0,
  attempts: {},
  setLesson: (id, steps) =>
    set({ lessonId: id, steps, currentStepIndex: 0, startedAt: Date.now(), attempts: {} }),
  advance: () => set((s) => ({ currentStepIndex: s.currentStepIndex + 1 })),
  recordAttempt: () =>
    set((s) => ({
      attempts: { ...s.attempts, [s.currentStepIndex]: (s.attempts[s.currentStepIndex] || 0) + 1 },
    })),
  reset: () => set({ lessonId: null, steps: [], currentStepIndex: 0, startedAt: 0, attempts: {} }),
}));
