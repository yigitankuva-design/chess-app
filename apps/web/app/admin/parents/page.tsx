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
  child_names: string[];
}

const ALPHABET = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');

function firstLetter(name: string): string {
  const c = name.trim().charAt(0);
  return c ? c.toLocaleUpperCase('tr') : '';
}

export default function AdminParentsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/parents`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const availableLetters = new Set(rows.map((r) => firstLetter(r.name)));

  const filtered = rows.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.email.toLowerCase().includes(q.toLowerCase());
    const matchesLetter = !letter || firstLetter(r.name) === letter;
    return matchesSearch && matchesLetter;
  });

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const accents = ['neon-purple', 'neon-green', 'neon-cyan', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 n-text">Kullanıcılar</h1>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad veya e-posta ara..."
          className="neon-input max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setLetter(null)}
            className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
              letter === null
                ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/50'
                : 'text-white/70 hover:bg-white/5 border border-transparent'
            }`}
          >
            Tümü
          </button>
          {ALPHABET.map((ch) => {
            const has = availableLetters.has(ch);
            const active = letter === ch;
            return (
              <button
                key={ch}
                disabled={!has}
                onClick={() => setLetter(active ? null : ch)}
                className={`w-6 h-6 rounded-md text-xs font-bold transition-colors ${
                  active
                    ? 'bg-cyan-400/25 text-cyan-100 border border-cyan-400/60 shadow-[0_0_12px_-4px_rgba(34,211,238,0.8)]'
                    : has
                      ? 'text-cyan-300 hover:bg-cyan-400/10 border border-transparent'
                      : 'text-white/20 border border-transparent cursor-default'
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>
      </div>

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
                  <p className="text-sm n-muted truncate">
                    {p.child_names.length > 0 ? p.child_names.join(', ') : 'Çocuk yok'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
