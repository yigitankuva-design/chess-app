'use client';
import { useState } from 'react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { SentenceQuestionEx } from '@/components/lesson-steps/BoardExercise';
import { KONUM_PRATIGI_INSTRUCTION } from '@/lib/admin/konumPratigiSteps';
import type { KonumPratigiQuestion } from '@/lib/customTabsApi';

interface Props {
  questions: KonumPratigiQuestion[];
}

/** Fisher–Yates — sayfa her açıldığında havuz BİR KEZ karıştırılır, oturum
 *  boyunca aynı sıra kalır (Zafer'in "karışık sırayla gelsin" isteği). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toExercise(q: KonumPratigiQuestion): SentenceQuestionEx {
  return {
    type: 'sentence_question',
    // Madde 2026-09-06 (üçüncü tur/2): admin artık talimat yazmıyor —
    // q.instruction'daki (varsa eski/DB'deki) değer YOK SAYILIR, sporcuya
    // HER SORUDA aynı sabit talimat gösterilir.
    instruction: KONUM_PRATIGI_INSTRUCTION,
    fen: q.fen,
    sentence_show_board: true,
    answer_kind: q.answer_kind,
    options: q.options,
    correct_index: q.correct_index,
    code: q.code ?? undefined,
    success_msg: q.success_msg,
    fail_msg: q.fail_msg,
  };
}

/**
 * a) Açılışı Tahmin Et (eski adıyla Konum Pratiği) — sporcunun açılış
 * konumlarını tanıyıp tanımadığını
 * ölçen çoktan seçmeli soru havuzu. Sıfır yeni geri bildirim/skor kodu:
 * havuz `sentence_question` şekline çevrilip doğrudan `BoardExercise`'e
 * verilir — ilerleme noktaları, KOD gösterimi, doğru/yanlış kartı hepsi
 * zaten orada (Dersler'de kullanılan AYNI bileşen).
 */
export function KonumPratigiPractice({ questions }: Props) {
  const [shuffled] = useState(() => shuffle(questions).map(toExercise));

  if (questions.length === 0) {
    return <p className="px-4 text-sm t-muted">Bu bölümde henüz soru yok.</p>;
  }

  return (
    <div className="px-4 pt-3 max-w-2xl mx-auto">
      {/* Madde: app/(child)/pratik/[mode]/page.tsx'teki "Süresiz Pratik"
          modlarıyla AYNI karar — bağımsız soru havuzu pratiğinde yanlış
          cevaptan sonra tekrar deneme YOK, sporcu "Sonraki Soruya Geç" ile
          ilerler (ders içindeki sentence_question'ın aksine, orada retry
          serbest kalır). */}
      {/* Madde 2026-09-04 (5): "0/1"/"Soru X/Y" kenarlıklı kutuda, talimat
          ikonu olmadan — SADECE bu ekranda. Madde 2026-09-06 (ikinci tur/F):
          başlık artık BoardExercise'in progress satırında (aynı sayfadaki
          ayrı <p>Konum Pratiği</p> kaldırıldı) ve tahta büyütüldü. */}
      <BoardExercise
        exercises={shuffled} done={false} onCorrect={() => {}} noRetry
        boxedProgress hideInstructionIcon
        headerTitle="Açılışı Tahmin Et" boardMaxWidth={360}
      />
    </div>
  );
}
