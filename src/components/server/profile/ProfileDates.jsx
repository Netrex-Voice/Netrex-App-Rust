import { memo } from "react";
import { Calendar, Sparkles } from "lucide-react";

const formatDate = (timestamp) => {
  if (!timestamp) return "Bilinmiyor";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
};

/**
 * ✅ ProfileDates - Isolated component
 * Re-renders only when dates change
 */
const ProfileDates = memo(({ joinedAt, createdAt }) => {
  return (
    <div className="pt-2 border-t border-white/5 space-y-2">
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#1e1f22] to-[#16171a] p-2.5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors group/date">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover/date:bg-indigo-500/20 transition-colors">
          <Calendar size={14} className="text-indigo-400" />
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wide">Sunucuya Katıldı</span>
          <span className="text-xs font-medium text-white">{formatDate(joinedAt)}</span>
        </div>
      </div>

      {createdAt && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#1e1f22] to-[#16171a] p-2.5 rounded-xl border border-white/5 hover:border-green-500/30 transition-colors group/date">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover/date:bg-green-500/20 transition-colors">
            <Sparkles size={14} className="text-green-400" />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wide">Netrex'e Katıldı</span>
            <span className="text-xs font-medium text-white">{formatDate(createdAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.joinedAt === nextProps.joinedAt &&
    prevProps.createdAt === nextProps.createdAt
  );
});

ProfileDates.displayName = 'ProfileDates';

export default ProfileDates;
