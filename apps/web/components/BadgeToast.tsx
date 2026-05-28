'use client';
import { motion, AnimatePresence } from 'framer-motion';

interface Badge {
  slug: string;
  name_tr: string;
  description_tr: string;
  icon: string;
}

export function BadgeToast({ badge, onClose }: { badge: Badge | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={onClose}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-yellow-100 border-2 border-yellow-400 rounded-2xl p-4 shadow-2xl flex items-center gap-3 z-50 cursor-pointer"
        >
          <span className="text-4xl">🏆</span>
          <div>
            <p className="font-bold">{badge.name_tr}</p>
            <p className="text-sm opacity-75">{badge.description_tr}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
