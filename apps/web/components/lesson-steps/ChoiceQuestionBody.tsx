'use client';
import type { ChoiceTypeConfig } from './BoardExercise';
import { ChoiceQuestionVisual } from './ChoiceQuestionVisual';
import { ChoiceQuestionAnswers } from './ChoiceQuestionAnswers';

interface Props {
  exercise: ChoiceTypeConfig;
  disabled: boolean;
  onAnswer: (index: number) => void;
}

/** Çoktan seçmeli sorunun TAMAMI — görsel + cevaplar.
 *  Yerleşimi dikey/yatay ayıran `BoardExercise` iki parçayı AYRI AYRI
 *  kullanır; bu kabuk geriye uyumluluk için (ve tek parça isteyen yerler
 *  için) ikisini sırayla render etmeye devam eder. */
export function ChoiceQuestionBody({ exercise, disabled, onAnswer }: Props) {
  return (
    <>
      <ChoiceQuestionVisual exercise={exercise} />
      <ChoiceQuestionAnswers exercise={exercise} disabled={disabled} onAnswer={onAnswer} />
    </>
  );
}
