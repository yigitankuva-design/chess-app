import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/assignmentsApi', () => ({
  listMyClasses: vi.fn(() => Promise.resolve([{ id: 1, name: 'Salı Grubu', join_code: 'ABC12345' }])),
  searchStudents: vi.fn(() => Promise.resolve([
    { id: 9, display_name: 'Elif', avatar: 'default', class_id: null, class_name: null },
  ])),
  listAdminModules: vi.fn(() => Promise.resolve([
    { id: 1, order_index: 1, name: 'Temel Düzey', description: '', lesson_count: 2, icon: 'i' },
  ])),
  listAdminModuleLessons: vi.fn(() => Promise.resolve([
    { id: 5, module_id: 1, order_index: 1, title: 'Açık Oyunlar', estimated_minutes: 8 },
  ])),
  createClassAssignment: vi.fn(() => Promise.resolve({ id: 100 })),
  createIndividualAssignment: vi.fn(() => Promise.resolve({ id: 101 })),
}));

import { AssignHomeworkPanel } from '@/components/admin/AssignHomeworkPanel';
import {
  listMyClasses, searchStudents, createClassAssignment, createIndividualAssignment,
} from '@/lib/assignmentsApi';

function setup() {
  render(<AssignHomeworkPanel sourceSectionId={42} sourceSectionTitle="İtalyan Açılışı" />);
}

describe('AssignHomeworkPanel — Antrenör → Ödev → Dersler köprüsü (madde 2026-09-05)', () => {
  it('kapalı başlar, tıklayınca açılır ve sınıfları/modülleri yükler', async () => {
    setup();
    expect(screen.queryByText('Modül seç…')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('📌 Ödev Olarak Ver'));
    await waitFor(() => expect(listMyClasses).toHaveBeenCalled());
    expect(await screen.findByText('Modül seç…')).toBeInTheDocument();
  });

  it('sınıfa ödev verme: modül+sınıf+başlık girilmeden buton disabled kalır', async () => {
    setup();
    fireEvent.click(screen.getByText('📌 Ödev Olarak Ver'));
    await screen.findByText('Modül seç…');
    expect(screen.getByText('Ödevi Ver')).toBeDisabled();
  });

  it('sınıfa ödev verme: tüm alanlar dolunca createClassAssignment çağrılır (source id ile)', async () => {
    setup();
    fireEvent.click(screen.getByText('📌 Ödev Olarak Ver'));
    await screen.findByText('Modül seç…');

    fireEvent.change(screen.getByLabelText('Hedef sınıf'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Hedef modül'), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText('Ödev başlığı'), { target: { value: 'Hafta 1' } });

    await waitFor(() => expect(screen.getByText('Ödevi Ver')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Ödevi Ver'));

    await waitFor(() => expect(createClassAssignment).toHaveBeenCalledWith(1, expect.objectContaining({
      title: 'Hafta 1',
      target_module_id: 1,
      source_custom_tab_section_id: 42,
    })));
  });

  it('tek öğrenciye ödev verme: arama sonucundan seçilen öğrenciye createIndividualAssignment çağrılır', async () => {
    setup();
    fireEvent.click(screen.getByText('📌 Ödev Olarak Ver'));
    await screen.findByText('Modül seç…');

    fireEvent.click(screen.getByText('Tek Öğrenci'));
    fireEvent.change(screen.getByPlaceholderText('Öğrenci adı ara…'), { target: { value: 'Elif' } });
    fireEvent.click(screen.getByText('Ara'));
    await waitFor(() => expect(searchStudents).toHaveBeenCalledWith('Elif'));

    fireEvent.click(await screen.findByText('Elif'));
    fireEvent.change(screen.getByLabelText('Hedef modül'), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText('Ödev başlığı'), { target: { value: 'Bireysel Ödev' } });

    fireEvent.click(screen.getByText('Ödevi Ver'));
    await waitFor(() => expect(createIndividualAssignment).toHaveBeenCalledWith(9, expect.objectContaining({
      title: 'Bireysel Ödev',
      source_custom_tab_section_id: 42,
    })));
  });
});
