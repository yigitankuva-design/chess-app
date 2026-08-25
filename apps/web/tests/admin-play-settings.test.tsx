import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));

import { PlaySettingsFields } from '@/components/admin/PlaySettingsFields';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';

function lastPatchBody(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(call[1].body as string);
}

describe('PlaySettingsFields — Bot Seviyeleri', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })) as never;
  });

  it('10 düzey satırı gösterilir', () => {
    render(<PlaySettingsFields play={DEFAULT_SETTINGS.play} onSaved={vi.fn()} />);
    for (let i = 1; i <= 10; i++) expect(screen.getByText(`Düzey ${i}`)).toBeInTheDocument();
  });

  it('bir düzeyin skill değeri değiştirilip kaydedilince PATCH /admin/settings play.levels gönderir', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    render(<PlaySettingsFields play={DEFAULT_SETTINGS.play} onSaved={vi.fn()} />);
    const row = screen.getByText('Düzey 1').closest('div')!;
    const skillInput = row.querySelectorAll('input')[0];
    fireEvent.change(skillInput, { target: { value: '15' } });
    fireEvent.click(screen.getByText('Bot seviyelerini kaydet'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = lastPatchBody(fetchMock);
    expect(body.play.levels[0].skill).toBe(15);
  });
});

describe('PlaySettingsFields — Süre Kontrolü', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })) as never;
  });

  it('mevcut süre kategorileri ve item etiketleri gösterilir', () => {
    render(<PlaySettingsFields play={DEFAULT_SETTINGS.play} onSaved={vi.fn()} />);
    expect(screen.getByText('Yıldırım')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3+2')).toBeInTheDocument();
  });

  it('+ Süre Ekle ile yeni satır eklenir, kaydedince PATCH gönderilir', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    render(<PlaySettingsFields play={DEFAULT_SETTINGS.play} onSaved={vi.fn()} />);
    const beforeFirstCat = DEFAULT_SETTINGS.play.timeGroups[0].items.length;
    const beforeTotal = screen.getAllByPlaceholderText('Etiket (örn. 5+3)').length;
    fireEvent.click(screen.getAllByText('+ Süre Ekle')[0]);
    expect(screen.getAllByPlaceholderText('Etiket (örn. 5+3)').length).toBe(beforeTotal + 1);

    fireEvent.click(screen.getByText('Süre kontrolünü kaydet'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = lastPatchBody(fetchMock);
    expect(body.play.timeGroups[0].items.length).toBe(beforeFirstCat + 1);
  });

  it('Sil ile bir süre kaldırılır', () => {
    render(<PlaySettingsFields play={DEFAULT_SETTINGS.play} onSaved={vi.fn()} />);
    const before = screen.getAllByPlaceholderText('Etiket (örn. 5+3)').length;
    fireEvent.click(screen.getAllByText('Sil')[0]);
    expect(screen.getAllByPlaceholderText('Etiket (örn. 5+3)').length).toBe(before - 1);
  });
});

describe('PlaySettingsFields — Turnuva Varsayılanları', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })) as never;
  });

  it('varsayılan tur sayısı/süre/puanlı değeri gösterilir ve değiştirilip kaydedilebilir', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    render(<PlaySettingsFields play={DEFAULT_SETTINGS.play} onSaved={vi.fn()} />);
    const roundsInput = screen.getByDisplayValue(String(DEFAULT_SETTINGS.play.tournamentDefaults.roundsTotal));
    fireEvent.change(roundsInput, { target: { value: '6' } });
    fireEvent.click(screen.getByText('Turnuva varsayılanlarını kaydet'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = lastPatchBody(fetchMock);
    expect(body.play.tournamentDefaults.roundsTotal).toBe(6);
  });

  it('kaydedilince onSaved çağrılır', async () => {
    const onSaved = vi.fn();
    render(<PlaySettingsFields play={DEFAULT_SETTINGS.play} onSaved={onSaved} />);
    fireEvent.click(screen.getByText('Turnuva varsayılanlarını kaydet'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
