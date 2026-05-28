'use client';
import { useState } from 'react';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Props { classId: number; }

export function AssignmentForm({ classId }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!title.trim()) { setError('Başlık gerekli'); return; }
    setError('');
    const token = getToken();
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      }),
    });
    if (res.ok) {
      setSuccess(true); setTitle(''); setDescription(''); setDueDate('');
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError('Ödev oluşturulamadı');
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-xl font-bold">Yeni Ödev</h2>
      {success && <p className="text-green-600 font-medium">✅ Ödev oluşturuldu!</p>}
      {error && <p className="text-red-600">{error}</p>}
      <div>
        <label className="block text-sm font-medium mb-1">Başlık *</label>
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          className="w-full p-2 border rounded" placeholder="Ödev başlığı"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Açıklama</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          className="w-full p-2 border rounded h-24 resize-none" placeholder="İsteğe bağlı açıklama"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Son Tarih</label>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-2 border rounded" />
      </div>
      <button onClick={submit} className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">
        Ödevi Oluştur
      </button>
    </div>
  );
}
