import { memo } from "react";
import { Users } from "lucide-react";

const shimmerClass = "animate-pulse bg-white/[0.06] rounded";

const MemberRowSkeleton = memo(({ index }) => (
  <div className="flex items-center gap-3 px-4 py-1.5">
    <div className={`w-8 h-8 rounded-full shrink-0 ${shimmerClass}`} />
    <div className="flex-1 space-y-1.5">
      <div className={`h-3 ${shimmerClass}`} style={{ width: `${60 + (index % 3) * 20}%` }} />
      <div className={`h-2 w-12 ${shimmerClass}`} />
    </div>
  </div>
));
MemberRowSkeleton.displayName = "MemberRowSkeleton";

const SectionSkeleton = memo(({ count = 3, startIndex = 0 }) => (
  <>
    {/* Section Header */}
    <div className="flex items-center px-4 pt-3 pb-1">
      <div className={`h-2.5 w-20 ${shimmerClass}`} />
    </div>
    {/* Member Rows */}
    {Array.from({ length: count }, (_, i) => (
      <MemberRowSkeleton key={startIndex + i} index={startIndex + i} />
    ))}
  </>
));
SectionSkeleton.displayName = "SectionSkeleton";

export default function ServerMemberListSkeleton({ onClose }) {
  return (
    <div className="w-full h-full bg-[#111214] flex flex-col relative overflow-hidden border-l border-white/[0.06]">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/[0.03] blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-500/[0.02] blur-[60px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0 bg-[#111214]/80 backdrop-blur-xl border-b border-white/[0.06] relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
            <Users size={16} className="text-[#949ba4]" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Üyeler</h3>
            <div className={`h-2 w-10 mt-1 ${shimmerClass}`} />
          </div>
        </div>
      </div>

      {/* Member List Skeleton */}
      <div className="flex-1 relative z-10 overflow-hidden py-2">
        <SectionSkeleton count={1} startIndex={0} />
        <SectionSkeleton count={3} startIndex={1} />
        <SectionSkeleton count={2} startIndex={4} />
      </div>
    </div>
  );
}
