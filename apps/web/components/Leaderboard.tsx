import { avatarEmoji } from '@/lib/avatars';

interface Entry { child_id: number; display_name: string; avatar: string; xp_total: number; rank_name: string; }

interface Props { entries: Entry[]; }

export function Leaderboard({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-gray-500">Lider tablosu için öğrenci gerekmektedir.</p>;
  }
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={e.child_id} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow">
          <span className="text-2xl w-8 text-center">{medals[i] ?? `${i + 1}.`}</span>
          <span className="text-3xl">{avatarEmoji(e.avatar)}</span>
          <div className="flex-1">
            <p className="font-bold">{e.display_name}</p>
            <p className="text-sm text-gray-500">{e.rank_name}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-blue-600">{e.xp_total} XP</p>
          </div>
        </div>
      ))}
    </div>
  );
}
