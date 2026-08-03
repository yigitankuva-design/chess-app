import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ChoiceExerciseFields', () => {
  it('sentence_question: tahta kurulunca çizim paneli görünür ve submit\'te annotations gider', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Hangi kare?' } });
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);

    expect(screen.getByText('Yazı-Şekil-Renk Ekle (opsiyonel)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Yıldız'));
    fireEvent.pointerDown(screen.getByTestId('paint-board-box'), { clientX: 40, clientY: 40 });

    const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
    fireEvent.change(optionInputs[0], { target: { value: 'A' } });
    fireEvent.change(optionInputs[1], { target: { value: 'B' } });
    fireEvent.click(screen.getByText('2 seçenek'));
    fireEvent.click(screen.getByText('Cümle'));
    fireEvent.click(screen.getByText('Kolay'));
    fireEvent.click(screen.getByText('Soruyu ekle'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.annotations).toHaveLength(1);
    expect(sent.annotations[0].shape).toBe('star');
  });


  it('sentence_question: 2 boş seçenekle başlar, doldurup gönderince doğru şekli üretir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Atın hareketi?' } });
    const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
    fireEvent.change(optionInputs[0], { target: { value: 'L şeklinde' } });
    fireEvent.change(optionInputs[1], { target: { value: 'Düz çizgide' } });
    // Adim kilidi: "Belirle" adimlari BILFIIL tiklanmali (kullanicinin 3b maddesi).
    fireEvent.click(screen.getByText('2 seçenek'));
    fireEvent.click(screen.getByText('Cümle'));
    fireEvent.click(screen.getByText('Kolay'));
    fireEvent.click(screen.getByText('Soruyu ekle'));

    // submit() async — waitFor ile bekle (çıplak `await Promise.resolve()` güvenilir değil)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sentence_question',
      instruction: 'Atın hareketi?',
      answer_kind: 'sentence',
      options: ['L şeklinde', 'Düz çizgide'],
      correct_index: 0,
    }));
  });

  it('seçenek sayısı 4e çıkarılınca 4 giriş alanı görünür', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('4 seçenek'));
    expect(screen.getAllByPlaceholderText(/\d\. şık/)).toHaveLength(4);
  });

  it('seçenek sayısı azaltılınca fazla seçenekler kırpılır ve doğru cevap sınır dışındaysa sıfırlanır', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('4 seçenek'));
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[3]); // 4. seçeneği doğru işaretle
    fireEvent.click(screen.getByText('2 seçenek'));
    const radiosAfter = screen.getAllByRole('radio');
    expect(radiosAfter).toHaveLength(2);
    expect((radiosAfter[0] as HTMLInputElement).checked).toBe(true);
  });

  it('boş cevapla gönderim ADIM KİLİDİYLE engellenir', () => {
    const onSubmit = vi.fn();
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'x' } });
    // Cevaplar bos: buton kilitli, eksik adim ekranda.
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
    fireEvent.click(screen.getByText('Soruyu ekle'));
    expect(onSubmit).not.toHaveBeenCalled();
    // Eksik satiri ILK eksigi yazar: talimat dolu, sirada "Seçenek Sayısını Belirle" var.
    expect(screen.getByText(/Eksik: 2\. Seçenek Sayısını Belirle/)).toBeInTheDocument();
  });

  it('image_question: görsel seçilmeden ilk eksik adım "Soru Görseli Seç"tir', () => {
    const onSubmit = vi.fn();
    render(<ChoiceExerciseFields kind="image_question" onSubmit={onSubmit} />);
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
    expect(screen.getByText(/Eksik: 1\. Soru Görseli Seç/)).toBeInTheDocument();
  });

  it('image_question: Talimat girişi tahta (Bilgisayardan Seç) alanından ÖNCE görünür (madde 5)', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    const instructionInput = screen.getByPlaceholderText('Talimat');
    const uploadLabel = screen.getByText('Bilgisayardan Seç');
    // Node.DOCUMENT_POSITION_FOLLOWING = 4 → uploadLabel, instruction'dan SONRA gelmeli
    const position = instructionInput.compareDocumentPosition(uploadLabel);
    expect(position & 4).toBeTruthy();
  });

  it('sentence_question: tahta kurulup kaydedilirse submit fen ve sentence_show_board gönderir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Hangi kare?' } });
    // Tahtaya bir taş koy — palet taşına tıkla, sonra kareye tıkla (BoardEditor tıkla-ekle deseni).
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);

    const boardShowCheckbox = screen.getByLabelText('Sporcu tahtayı da görsün (Cümle Ekle)');
    expect(boardShowCheckbox).toBeChecked();
    fireEvent.click(boardShowCheckbox);
    expect(boardShowCheckbox).not.toBeChecked();

    const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
    fireEvent.change(optionInputs[0], { target: { value: 'A' } });
    fireEvent.change(optionInputs[1], { target: { value: 'B' } });
    fireEvent.click(screen.getByText('2 seçenek'));
    fireEvent.click(screen.getByText('Cümle'));
    fireEvent.click(screen.getByText('Kolay'));
    fireEvent.click(screen.getByText('Soruyu ekle'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sentence_question',
      sentence_show_board: false,
    }));
  });

  it('sentence_question: tahta kurulmazsa (boş) fen gönderilmez', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Soru?' } });
    const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
    fireEvent.change(optionInputs[0], { target: { value: 'A' } });
    fireEvent.change(optionInputs[1], { target: { value: 'B' } });
    fireEvent.click(screen.getByText('2 seçenek'));
    fireEvent.click(screen.getByText('Cümle'));
    fireEvent.click(screen.getByText('Kolay'));
    fireEvent.click(screen.getByText('Soruyu ekle'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const call = onSubmit.mock.calls[0][0];
    expect(call.fen).toBeUndefined();
  });
});
