import { memo } from "react";

// ✅ Shimmer animasyonu + skeleton blokları
// Veri gelene kadar kullanıcıya "yükleniyor" hissi veriyor
const shimmerClass = "animate-pulse bg-white/[0.06] rounded";

const ChannelSkeleton = memo(({ width = "w-24" }) => (
  <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
    <div className={`w-4 h-4 rounded ${shimmerClass}`} />
    <div className={`h-3.5 ${width} ${shimmerClass}`} />
  </div>
));
ChannelSkeleton.displayName = "ChannelSkeleton";

const VoiceChannelSkeleton = memo(() => (
  <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
    <div className="flex items-center gap-2.5 mb-2">
      <div className={`w-4 h-4 rounded ${shimmerClass}`} />
      <div className={`h-3.5 w-28 ${shimmerClass}`} />
    </div>
    <div className={`h-2.5 w-16 ml-6 ${shimmerClass}`} />
  </div>
));
VoiceChannelSkeleton.displayName = "VoiceChannelSkeleton";

export default function ServerSidebarSkeleton() {
  return (
    <div className="w-sidebar h-full flex flex-col shrink-0 relative bg-[#0a0a0c] border-r border-white/5 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />

      {/* Header Skeleton */}
      <div className="relative z-10 p-4 pb-2">
        <div className="flex items-center gap-3 px-2 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <div className={`w-10 h-10 rounded-xl ${shimmerClass}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-4 w-32 ${shimmerClass}`} />
            <div className={`h-2.5 w-20 ${shimmerClass}`} />
          </div>
        </div>
      </div>

      {/* Channels Skeleton */}
      <div className="flex-1 overflow-hidden p-4 space-y-6">
        {/* Text Channels */}
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <div className={`h-2.5 w-14 ${shimmerClass}`} />
          </div>
          <div className="space-y-1">
            <ChannelSkeleton width="w-20" />
            <ChannelSkeleton width="w-28" />
            <ChannelSkeleton width="w-16" />
          </div>
        </div>

        {/* Voice Channels */}
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <div className={`h-2.5 w-20 ${shimmerClass}`} />
          </div>
          <div className="space-y-3">
            <VoiceChannelSkeleton />
            <VoiceChannelSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
