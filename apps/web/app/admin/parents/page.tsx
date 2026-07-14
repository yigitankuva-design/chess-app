'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ParentRow {
  id: number;
  name: string;
  email: string;
  created_at: string;
  child_count: number;
}

export default function AdminParentsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/parents`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.email.toLowerCase().includes(q.toLowerCase()),
  );

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const accents = ['neon-purple', 'neon-green', 'neon-cyan', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 n-text">Kullanıcılar</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ad veya e-posta ara..."
        className="neon-input max-w-sm mb-5"
      />
      {filtered.length === 0 ? (
        <p className="n-muted">Kullanıcı bulunamadı.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p, i) => {
            const accent = accents[i % accents.length];
            return (
              <Link
                key={p.id}
                href={`/admin/parents/${p.id}`}
                className={`neon-card neon-card-i ${accent} flex items-center gap-4 p-4`}
              >
                <span className={`neon-avatar ${accent} w-12 h-12 text-sm shrink-0`}>
                  {initials(p.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold n-text truncate">{p.name}</p>
                  <p className="text-sm n-muted truncate">{p.email}</p>
                  <p className="text-xs n-muted mt-0.5">Üyelik: {formatDate(p.created_at)}</p>
                </div>
                <span className={`neon-pill ${accent}`}>{p.child_count} çocuk</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
