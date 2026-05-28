'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DayData { date: string; minutes: number; lessons: number; puzzles: number; games: number; }

export function WeeklyActivityChart({ data }: { data: DayData[] }) {
  if (!data || data.length === 0) {
    return <p className="opacity-60 text-center py-8">Henüz aktivite yok.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(d) => String(d).slice(5)} fontSize={12} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="minutes" stroke="#3b82f6" name="Dakika" strokeWidth={2} />
        <Line type="monotone" dataKey="puzzles" stroke="#a855f7" name="Puzzle" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
