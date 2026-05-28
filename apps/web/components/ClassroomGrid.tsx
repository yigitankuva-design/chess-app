import { avatarEmoji } from '@/lib/avatars';

interface Student { id: number; display_name: string; avatar: string; age: number; }

interface Props { students: Student[]; }

export function ClassroomGrid({ students }: Props) {
  if (students.length === 0) {
    return <p className="text-gray-500">Bu sınıfta henüz öğrenci yok. Katılım kodunu velilerle paylaşın.</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {students.map(s => (
        <div key={s.id} className="p-4 bg-white rounded-lg shadow text-center">
          <div className="text-4xl mb-2">{avatarEmoji(s.avatar)}</div>
          <p className="font-medium text-sm">{s.display_name}</p>
          <p className="text-xs text-gray-400">{s.age} yaş</p>
        </div>
      ))}
    </div>
  );
}
