'use client';
import { useState, useRef } from 'react';
import { BoardEditor, EMPTY_FEN, fenToMap } from '@/components/BoardEditor';
import { ChoiceExerciseFields } from './ChoiceExerciseFields';
import type { ChoiceDraft } from './ChoiceExerciseFields';
import { MovePieceFields } from './MovePieceFields';
import { DIFFICULTY_LABELS, nearestDifficultyValue } from '@/lib/difficultyLabels';
import { movePieceSteps, firstIncompleteStep, allStepsDone, hasPieces } from '@/lib/admin/movePieceSteps';
import { clickSquareSteps, firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import { placePiecesSteps } from '@/lib/admin/placePiecesSteps';
import { clickPieceSteps } from '@/lib/admin/clickPieceSteps';
import { PlacePiecesFields } from './PlacePiecesFields';
import { SavedPositionBoard } from './SavedPositionBoard';
import { StepList } from './StepList';
import { PaintEditor } from './PaintEditor';
import type { MovePieceStepState } from '@/lib/admin/movePieceSteps';
import type { PaintItem } from '@/lib/chess/paintItems';

export type ExerciseType = 'click_square' | 'move_piece' | 'identify_piece' | 'place_pieces' | 'click_piece';
export type QuestionFamily = 'sentence_question' | 'image_question' | 'konum';

export interface BoardExercise {
  type: ExerciseType | 'sentence_question' | 'image_question';
  instruction: string;
  /** Sadece tahta tipleri (Konum Ekle) VE sentence_question (madde 5) için. */
  fen?: string;
  target_squares?: string[];
  piece_square?: string;
  highlight_square?: string;
  options?: string[];
  correct_index?: number;
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  difficulty?: number;
  /** 3 haneli kalıcı soru kodu (örn. "007") — admin panelinde atanır, değişmez. */
  code?: string;
  /** Sadece image_question için — data-URI. */
  prompt_image?: string;
  /** Sadece sentence_question/image_question için — cevapların tipi. */
  answer_kind?: 'sentence' | 'image';
  /** Sadece move_piece için — SAN hamle dizisi (Konumu Kaydet sonrası kaydedilir). */
  moves?: string[];
  /** Sadece image_question için — görselin tahta üzerindeki konumu/boyutu/tonu
   *  (yüzde 0-100, tone 0-10). Yoksa eski düz görünüm kullanılır (KURAL #3). */
  image_x?: number;
  image_y?: number;
  image_w?: number;
  image_h?: number;
  image_tone?: number;
  /** Sporcu ekranında boş tahta arka planı gösterilsin mi (varsayılan true). */
  image_show_board?: boolean;
  /** Sadece image_question için — YENİ çoklu görsel formatı. Varsa
   *  image_x/y/w/h/tone/prompt_image (eski tekil format) yok sayılır. */
  prompt_images?: { uri: string; x: number; y: number; w: number; h: number; tone: number }[];
  /** Sadece click_square için — sporcu tıklama modu (madde 2). Yoksa 'any'. */
  click_mode?: 'any' | 'all';
  /** Sadece place_pieces için — eksik taşlar ve doğru kareleri. */
  pieces?: { piece: string; square: string }[];
  /** Sadece click_piece için — cevap taşlarının bulunduğu kareler. */
  piece_squares?: string[];
  /** Sadece sentence_question için — sporcu tahtayı görsün mü (madde 5, varsayılan true). */
  sentence_show_board?: boolean;
  /** Tahtaya eklenen serbest yazı/şekil/renk öğeleri (C grubu, opsiyonel). */
  annotations?: PaintItem[];
}

interface Props {
  onSubmit: (ex: BoardExercise) => Promise<void>;
  initial?: BoardExercise;
  onCancel?: () => void;
}

const FAMILY_OPTIONS: [QuestionFamily, string][] = [
  ['sentence_question', 'Cümle ekle'],
  ['image_question', 'Görüntü ekle'],
  ['konum', 'Konum ekle'],
];

function familyOf(ex?: BoardExercise): QuestionFamily {
  if (ex?.type === 'sentence_question') return 'sentence_question';
  if (ex?.type === 'image_question') return 'image_question';
  return 'konum';
}

export function ExerciseForm({ onSubmit, initial, onCancel }: Props) {
  const [family, setFamily] = useState<QuestionFamily>(() => familyOf(initial));
  const editing = !!initial;
  /** Bolum basina taslak. SADECE yeni soru modunda; form kapaninca ucar (YAGNI).
   *  Konum'a taslak BILINCLI yok: tahta durumu yarim kopyalanirsa adim kilidi
   *  tutarsizlasir (spec 3.1). */
  const choiceDrafts = useRef<Partial<Record<'sentence_question' | 'image_question', ChoiceDraft>>>({});

  return (
    <div className="neon-card neon-green p-5 space-y-4">
      <h3 className="font-bold n-text">
        {editing ? 'Soruyu düzenle' : 'Yeni soru'}
        {editing && initial?.code && <span className="ml-2 text-xs font-mono n-muted">Kod: {initial.code}</span>}
      </h3>

      <div className="flex justify-center gap-3 flex-wrap">
        {FAMILY_OPTIONS.map(([f, label]) => (
          <button
            key={f}
            type="button"
            disabled={editing}
            onClick={() => setFamily(f)}
            className={`w-36 py-4 px-3 rounded-xl border text-center transition-colors ${
              family === f ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
            } ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span className="block font-semibold text-sm">{label}</span>
          </button>
        ))}
      </div>

      {family === 'konum' ? (
        <BoardExerciseFields key="konum" onSubmit={onSubmit} initial={initial} onCancel={onCancel} />
      ) : (
        <ChoiceExerciseFields
          key={family}
          kind={family}
          onSubmit={onSubmit}
          initial={initial}
          onCancel={onCancel}
          draft={editing ? undefined : choiceDrafts.current[family]}
          onDraftChange={editing ? undefined : (d) => { choiceDrafts.current[family] = d; }}
        />
      )}
    </div>
  );
}

function BoardExerciseFields({ onSubmit, initial, onCancel }: Props) {
  // Kayıtlı soru düzenlenirken tipi KORUNMALI. Liste eksik kalırsa tip
  // sessizce 'click_square'e düşer ve hocanın sorusu bozulur (ölçüldü).
  const [type, setType] = useState<ExerciseType>(
    initial && (initial.type === 'click_square' || initial.type === 'move_piece'
      || initial.type === 'identify_piece' || initial.type === 'place_pieces'
      || initial.type === 'click_piece')
      ? initial.type
      : 'click_square',
  );
  const [fen, setFen] = useState(initial?.fen ?? EMPTY_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>(
    initial?.fen ? ((initial.fen.split(' ')[1] as 'w' | 'b') ?? 'w') : 'w',
  );
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');
  const [targets, setTargets] = useState<string[]>(initial?.target_squares ?? []);
  const [highlight, setHighlight] = useState(initial?.highlight_square ?? '');
  const [options, setOptions] = useState<string[]>(
    initial?.options && initial.options.length > 0 ? initial.options : ['', ''],
  );
  const [correctIndex, setCorrectIndex] = useState(initial?.correct_index ?? 0);
  const [successMsg, setSuccessMsg] = useState(initial?.success_msg ?? '');
  const [failMsg, setFailMsg] = useState(initial?.fail_msg ?? '');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 1);
  const [clickMode, setClickMode] = useState<'any' | 'all'>(
    (initial?.type === 'click_square' && initial.click_mode) || 'any',
  );
  const [clickModeChosen, setClickModeChosen] = useState(!!initial);
  // "Taş Nerde?" — konum kaydı savedFen ile paylaşılır; taş/kare çiftleri burada.
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [placePairs, setPlacePairs] = useState<{ piece: string; square: string }[]>(
    initial?.pieces ?? [],
  );
  const [answerSaved, setAnswerSaved] = useState(!!initial);
  // "Taşa Tıkla" — cevap taşlarının kareleri; konum savedFen ile paylaşılır.
  const [pieceSquares, setPieceSquares] = useState<string[]>(initial?.piece_squares ?? []);
  const [pieceAnswerSaved, setPieceAnswerSaved] = useState(!!initial);
  // Kareye Tıkla: null = konum henüz kaydedilmedi (diz fazı). Düzenlemede kayıtlı.
  // Konumu "kaydedilmiş" sayan tipler — düzenlemede konum korunur.
  const [savedFen, setSavedFen] = useState<string | null>(
    initial && (initial.type === 'click_square' || initial.type === 'place_pieces'
      || initial.type === 'click_piece')
      ? (initial.fen ?? null)
      : null,
  );
  /** Hamle sırasına BİLFİİL tıklandı mı? Varsayılan Beyaz — tıklama şart (tuzak). */
  const [turnChosen, setTurnChosen] = useState(!!initial);
  // Taşı Oynat: null = henüz "Konumu Kaydet"e basılmadı (setup fazı).
  const [moveFen, setMoveFen] = useState<string | null>(
    initial?.moves?.length ? (initial.fen ?? null) : null,
  );
  const [moves, setMoves] = useState<string[]>(initial?.moves ?? []);
  /** Adım 5 — mevcut soruyu düzenlerken kayıtlı notasyon zaten onaylı sayılır (KURAL #3). */
  const [notationSaved, setNotationSaved] = useState(!!initial?.moves?.length);
  /**
   * Adım 6 — zorluk etiketine BİLFİİL tıklandı mı? `difficulty` varsayılanı 1 olduğu
   * için sayıya bakmak yetmez. Mevcut soruyu düzenlerken kayıtlı bir değer zaten var,
   * hocayı tekrar tıklamaya zorlamak regresyon olur (KURAL #3) — bu yüzden true başlar.
   */
  const [difficultyChosen, setDifficultyChosen] = useState(!!initial);
  const [annotations, setAnnotations] = useState<PaintItem[]>(initial?.annotations ?? []);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!initial;

  function toggleTarget(sq: string) {
    setTargets((prev) => (prev.includes(sq) ? prev.filter((x) => x !== sq) : [...prev, sq]));
  }

  function validate(): string | null {
    if (!instruction.trim()) return 'Talimat gerekli';
    const map = fenToMap(fen);
    if (type === 'click_square') {
      if (!savedFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (targets.length === 0) return 'En az bir doğru kare seç';
    }
    if (type === 'move_piece') {
      if (!moveFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (moves.length === 0) return 'En az bir hamle kaydedilmeli';
    }
    if (type === 'identify_piece') {
      if (!highlight) return 'Vurgulanacak kareyi seç';
      if (!map[highlight]) return 'Vurgulanan karede taş yok';
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return 'En az 2 şık gerekli';
      if (correctIndex >= opts.length) return 'Doğru şık geçersiz';
    }
    if (type === 'place_pieces') {
      if (!savedFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (placePairs.length === 0) return 'En az bir taş ve doğru karesi belirlenmeli';
      if (!answerSaved) return '"Cevabı Kaydet"e bas';
      // Backend de bakıyor; buradaki kontrol hatayı kullanıcıya ANINDA gösterir.
      const savedMap = fenToMap(savedFen);
      const dolu = placePairs.find((p) => savedMap[p.square]);
      if (dolu) return `${dolu.square} karesi dolu — eksik taşın karesi boş olmalı`;
    }
    if (type === 'click_piece') {
      if (!savedFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (pieceSquares.length === 0) return 'En az bir cevap taşı seç';
      if (!pieceAnswerSaved) return '"Taş Seçimini Kaydet"e bas';
      const map = fenToMap(savedFen);
      const bos = pieceSquares.find((sq) => !map[sq]);
      if (bos) return `${bos} karesinde taş yok`;
    }
    return null;
  }

  async function submit() {
    setErr(null);
    const v = validate();
    if (v) { setErr(v); return; }
    setSaving(true);
    const base: BoardExercise = { type, instruction: instruction.trim(), fen, difficulty };
    if (initial?.code) base.code = initial.code;
    if (annotations.length > 0) base.annotations = annotations;
    if (successMsg.trim()) base.success_msg = successMsg.trim();
    if (failMsg.trim()) base.fail_msg = failMsg.trim();
    if (type === 'click_square') { base.fen = savedFen!; base.target_squares = targets; base.click_mode = clickMode; }
    if (type === 'move_piece') { base.fen = moveFen!; base.moves = moves; }
    if (type === 'identify_piece') {
      base.highlight_square = highlight;
      base.options = options.map((o) => o.trim()).filter(Boolean);
      base.correct_index = correctIndex;
    }
    if (type === 'place_pieces') { base.fen = savedFen!; base.pieces = placePairs; }
    if (type === 'click_piece') { base.fen = savedFen!; base.piece_squares = pieceSquares; }
    try {
      await onSubmit(base);
      if (!editing) {
        setInstruction(''); setTargets([]); setHighlight('');
        setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg(''); setDifficulty(1);
        setMoveFen(null); setMoves([]); setNotationSaved(false); setDifficultyChosen(false);
        setSavedFen(null); setTurnChosen(false); setClickMode('any'); setClickModeChosen(false);
        setSelectedPiece(null); setPlacePairs([]); setAnswerSaved(false);
        setPieceSquares([]); setPieceAnswerSaved(false);
        setAnnotations([]);
      }
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  const squares = Object.keys(fenToMap(fen)).sort();

  const stepState: MovePieceStepState = {
    instruction, setupFen: fen, turnChosen, moveFen, moves, notationSaved, difficultyChosen,
  };
  const steps = movePieceSteps(stepState);
  const clickSteps = clickSquareSteps({
    instruction, setupFen: fen, turnChosen, savedFen, targets, clickModeChosen, difficultyChosen,
  });
  const placeSteps = placePiecesSteps({
    instruction, setupFen: fen, savedFen, selectedPiece,
    pieces: placePairs, answerSaved, turnChosen, difficultyChosen,
  });
  const clickPieceStepList = clickPieceSteps({
    instruction, setupFen: fen, savedFen, pieceSquares,
    answerSaved: pieceAnswerSaved, turnChosen, difficultyChosen,
  });
  const missing = type === 'click_square'
    ? firstIncomplete(clickSteps)
    : type === 'place_pieces'
      ? firstIncomplete(placeSteps)
      : type === 'click_piece'
        ? firstIncomplete(clickPieceStepList)
        : firstIncompleteStep(stepState);
  /** Kilit ÜÇ Konum tipine de uygulanır (kullanıcının 3e maddesi). */
  const gateOpen = type === 'move_piece'
    ? allStepsDone(stepState)
    : type === 'click_square'
      ? allDone(clickSteps)
      : type === 'place_pieces'
        ? allDone(placeSteps)
        : type === 'click_piece'
          ? allDone(clickPieceStepList)
          : true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([
          ['click_square', 'Kareye tıkla'],
          ['click_piece', 'Taşa tıkla'],
          ['move_piece', 'Taşı oynat'],
          ['place_pieces', 'Taş nerde?'],
        ] as [ExerciseType, string][]).map(([t, label]) => (
          <button key={t} type="button" disabled={editing}
            onClick={() => { setType(t); setTargets([]); setSavedFen(null); setErr(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              type === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
            } ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}>{label}</button>
        ))}
        {/* Tasi Tani YENI soruda yok; eski soru duzenlenirken rozetle gosterilir.
            Tip birligi ve validate/submit dallari YASIYOR — eski sorular calisir. */}
        {editing && type === 'identify_piece' && (
          <span className="px-2.5 py-1 rounded-lg text-xs border border-amber-400/50 text-amber-200 bg-amber-400/10">
            🏷 Bu soru &quot;Taşı tanı&quot; tipinde — yeni eklenemez
          </span>
        )}
      </div>

      {type === 'move_piece' && (
        <StepList steps={steps} missingNo={missing?.no ?? null} ariaLabel="Taşı Oynat adımları" />
      )}
      {type === 'click_square' && (
        <StepList steps={clickSteps} missingNo={missing?.no ?? null} ariaLabel="Kareye Tıkla adımları" />
      )}
      {type === 'place_pieces' && (
        <StepList steps={placeSteps} missingNo={missing?.no ?? null} ariaLabel="Taş Nerde? adımları" />
      )}
      {type === 'click_piece' && (
        <StepList steps={clickPieceStepList} missingNo={missing?.no ?? null} ariaLabel="Taşa Tıkla adımları" />
      )}

      <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
        placeholder="Talimat (örn. Piyonu e4'e taşı)" className="neon-input" />

      {/* Taşı oynat kendi tahtasını MovePieceFields içinde render ediyor —
          bu satır koşullanmazsa ekranda İKİ tahta olur. */}
      {/* move_piece ve place_pieces KENDİ tahtalarını çiziyor — koşullanmazsa
          ekranda İKİ tahta olur. */}
      {type !== 'move_piece' && type !== 'place_pieces'
        && ((type !== 'click_square' && type !== 'click_piece') || savedFen === null) && (
        <BoardEditor fen={fen} turn={turn} onChange={setFen}
          onTurnChange={(t) => { setTurn(t); setTurnChosen(true); }} />
      )}

      {/* Bos tahta da kaydedilebilir — kare ismi sorulari icin (disabled YOK). */}
      {type === 'click_square' && savedFen === null && (
        <button type="button"
          onClick={() => setSavedFen(fen)}
          className="px-4 py-2 rounded-lg text-sm bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 transition-colors">
          Konumu Kaydet
        </button>
      )}

      {type === 'click_square' && savedFen !== null && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#34d399' }}>Konum kaydedildi ✓</span>
            {/* Konum degisirse eski kareler gecersiz olabilir — kareler BILINCLI sifirlanir. */}
            <button type="button"
              onClick={() => { setSavedFen(null); setTargets([]); }}
              className="px-3 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
              Konumu Değiştir
            </button>
          </div>
          <p className="text-xs n-muted mb-1">
            Doğru kare(ler) — tahtada tıkla, birden çok seçebilirsin (tekrar tıklamak seçimi kaldırır)
          </p>
          {/* Madde 2026-08-24: kareler artık NOTASYONEL ŞABLONDAN (kare adı
              yazan butonlar) değil, doğrudan TAHTA üzerine tıklanarak seçilir —
              "Taşa Tıkla" ile AYNI etkileşim deseni. */}
          {savedFen && (
            <PaintEditor items={annotations} onChange={setAnnotations}>
              <SavedPositionBoard fen={savedFen} marked={targets} onSquareClick={toggleTarget} />
            </PaintEditor>
          )}
          <p className="text-xs n-muted">Seçili: {targets.length ? targets.join(', ') : '—'}</p>

          <p className="text-xs n-muted mt-3 mb-1">Sporcu Tıklama Sayısını Belirle</p>
          <div className="flex flex-wrap gap-2">
            {([['any', 'Tek Kareye Tıklaması Yeterli'], ['all', 'Tüm Cevap Karelerine Tıklasın']] as const).map(([m, label]) => (
              <button key={m} type="button"
                onClick={() => { setClickMode(m); setClickModeChosen(true); }}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  clickMode === m && clickModeChosen ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
                }`}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {type === 'move_piece' && (
        <MovePieceFields
          setupFen={fen}
          onSetupFenChange={setFen}
          setupTurn={turn}
          onSetupTurnChange={(t) => { setTurn(t); setTurnChosen(true); }}
          fen={moveFen}
          moves={moves}
          onChange={(f, m) => { setMoveFen(f); setMoves(m); }}
          notationSaved={notationSaved}
          onNotationSavedChange={setNotationSaved}
          annotations={annotations}
          onAnnotationsChange={setAnnotations}
        />
      )}

      {type === 'place_pieces' && (
        <PlacePiecesFields
          fen={fen}
          turn={turn}
          savedFen={savedFen}
          selectedPiece={selectedPiece}
          pieces={placePairs}
          annotations={annotations}
          onAnnotationsChange={setAnnotations}
          onFenChange={setFen}
          onTurnChange={(t) => { setTurn(t); setTurnChosen(true); }}
          onSavePosition={() => setSavedFen(fen)}
          onSelectPiece={setSelectedPiece}
          onAddPair={(piece, square) => {
            // Aynı kareye ikinci taş konmaz — üzerine yazılır. Böylece backend'in
            // "aynı kare iki kez" hatası kullanıcıya hiç ulaşmaz.
            setPlacePairs((prev) => [...prev.filter((p) => p.square !== square), { piece, square }]);
            setSelectedPiece(null);
            setAnswerSaved(false);
          }}
          onRemovePair={(i) => {
            setPlacePairs((prev) => prev.filter((_, idx) => idx !== i));
            setAnswerSaved(false);
          }}
        />
      )}

      {/* Stil MovePieceFields.tsx:85'teki "Notasyonu Kaydet" ile aynı. */}
      {type === 'place_pieces' && placePairs.length > 0 && !answerSaved && (
        <button type="button" onClick={() => setAnswerSaved(true)}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm transition-colors">
          Cevabı Kaydet
        </button>
      )}

      {type === 'click_piece' && savedFen === null && (
        <button type="button" onClick={() => setSavedFen(fen)}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
          Konumu Kaydet
        </button>
      )}

      {type === 'click_piece' && savedFen !== null && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#34d399' }}>Konum kaydedildi ✓</span>
            {/* Konum değişirse seçilen taşlar geçersiz olur — BİLİNÇLİ sıfırlanır. */}
            <button type="button"
              onClick={() => { setSavedFen(null); setPieceSquares([]); setPieceAnswerSaved(false); }}
              className="px-3 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
              Konumu Değiştir
            </button>
          </div>
          <p className="text-xs n-muted">Cevap taşlarına tıkla — tekrar tıklamak seçimi kaldırır</p>
          <PaintEditor items={annotations} onChange={setAnnotations}>
            <SavedPositionBoard
              fen={savedFen}
              marked={pieceSquares}
              onSquareClick={(sq) => {
                // Cevap TAŞTIR: boş kareye tıklamak seçim yapmaz.
                if (!fenToMap(savedFen)[sq]) return;
                setPieceSquares((prev) => (prev.includes(sq) ? prev.filter((x) => x !== sq) : [...prev, sq]));
                setPieceAnswerSaved(false);
              }}
            />
          </PaintEditor>
          <p className="text-xs n-muted">Seçili: {pieceSquares.length ? pieceSquares.join(', ') : '—'}</p>
          {pieceSquares.length > 0 && !pieceAnswerSaved && (
            <button type="button" onClick={() => setPieceAnswerSaved(true)}
              className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm transition-colors">
              Taş Seçimini Kaydet
            </button>
          )}
        </div>
      )}

      {type === 'identify_piece' && (
        <div className="space-y-2">
          <div>
            <p className="text-xs n-muted mb-1">Vurgulanacak kare (taşın olduğu)</p>
            <select value={highlight} onChange={(e) => setHighlight(e.target.value)}
              className="neon-input py-1.5 text-xs max-w-[10rem]">
              <option value="">seç</option>
              {squares.map((s) => <option key={s} value={s}>{s} ({fenToMap(fen)[s]})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="ex-correct" checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)} aria-label={`${i + 1}. şık doğru`}
                  className="h-4 w-4 accent-cyan-400" />
                <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`${i + 1}. şık`} className="neon-input flex-1" />
              </div>
            ))}
            <button type="button" onClick={() => setOptions([...options, ''])}
              className="px-3 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
              + Şık ekle
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={successMsg} onChange={(e) => setSuccessMsg(e.target.value)}
          placeholder="Doğru mesajı (opsiyonel)" className="neon-input" />
        <input value={failMsg} onChange={(e) => setFailMsg(e.target.value)}
          placeholder="Yanlış mesajı (opsiyonel)" className="neon-input" />
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Sorunun Zorluk Düzeyini Belirle</p>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_LABELS.map(([val, label]) => (
            <button key={val} type="button"
              onClick={() => { setDifficulty(val); setDifficultyChosen(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                nearestDifficultyValue(difficulty) === val ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={submit} disabled={saving || !gateOpen}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm transition-colors">
          {saving ? 'Kaydediliyor...' : editing ? 'Soruyu kaydet' : 'Soruyu ekle'}
        </button>
        {!gateOpen && missing && (
          <span className="text-xs n-muted">Eksik: {missing.no}. {missing.label}</span>
        )}
        {editing && onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
            İptal
          </button>
        )}
      </div>
    </div>
  );
}
