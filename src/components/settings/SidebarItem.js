import { ChevronRight } from "lucide-react";

export default function SidebarItem({ label, icon, active, onClick, color = "indigo" }) {
  const colorClasses = {
    indigo: {
      activeBg: "from-indigo-500/20 to-indigo-600/10",
      activeBorder: "border-indigo-500/40",
      activeIcon: "text-indigo-400",
      activeDot: "bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]",
      hoverBg: "group-hover/item:from-indigo-500/10 group-hover/item:to-indigo-600/5",
    },
    purple: {
      activeBg: "from-purple-500/20 to-purple-600/10",
      activeBorder: "border-purple-500/40",
      activeIcon: "text-purple-400",
      activeDot: "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]",
      hoverBg: "group-hover/item:from-purple-500/10 group-hover/item:to-purple-600/5",
    },
    cyan: {
      activeBg: "from-cyan-500/20 to-cyan-600/10",
      activeBorder: "border-cyan-500/40",
      activeIcon: "text-cyan-400",
      activeDot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]",
      hoverBg: "group-hover/item:from-cyan-500/10 group-hover/item:to-cyan-600/5",
    },
    orange: {
      activeBg: "from-orange-500/20 to-orange-600/10",
      activeBorder: "border-orange-500/40",
      activeIcon: "text-orange-400",
      activeDot: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]",
      hoverBg: "group-hover/item:from-orange-500/10 group-hover/item:to-orange-600/5",
    },
    yellow: {
      activeBg: "from-yellow-500/20 to-yellow-600/10",
      activeBorder: "border-yellow-500/40",
      activeIcon: "text-yellow-400",
      activeDot: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]",
      hoverBg: "group-hover/item:from-yellow-500/10 group-hover/item:to-yellow-600/5",
    },
    pink: {
      activeBg: "from-pink-500/20 to-pink-600/10",
      activeBorder: "border-pink-500/40",
      activeIcon: "text-pink-400",
      activeDot: "bg-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.6)]",
      hoverBg: "group-hover/item:from-pink-500/10 group-hover/item:to-pink-600/5",
    },
    green: {
      activeBg: "from-green-500/20 to-green-600/10",
      activeBorder: "border-green-500/40",
      activeIcon: "text-green-400",
      activeDot: "bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]",
      hoverBg: "group-hover/item:from-green-500/10 group-hover/item:to-green-600/5",
    },
    amber: {
      activeBg: "from-amber-500/20 to-amber-600/10",
      activeBorder: "border-amber-500/40",
      activeIcon: "text-amber-400",
      activeDot: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
      hoverBg: "group-hover/item:from-amber-500/10 group-hover/item:to-amber-600/5",
    },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 w-full text-left mb-0.5 relative group/item overflow-hidden focus:outline-none ${
        active
          ? `bg-gradient-to-r ${colors.activeBg} text-white border ${colors.activeBorder}`
          : "text-[#949ba4] hover:text-white border border-transparent hover:bg-white/5"
      }`}
    >
      {/* Hover glow background */}
      <div
        className={`absolute inset-0 bg-gradient-to-r from-transparent to-transparent transition-all duration-300 ${
          active ? "" : colors.hoverBg
        }`}
      ></div>

      {/* Icon container */}
      <div
        className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
          active
            ? `bg-white/10 ${colors.activeIcon}`
            : "bg-white/5 text-[#949ba4] group-hover/item:bg-white/10 group-hover/item:text-white"
        }`}
      >
        {icon}
      </div>
      
      <span className="relative z-10 flex-1">{label}</span>

      {/* Active indicator */}
      {active && (
        <div className={`relative z-10 w-2 h-2 rounded-full animate-pulse ${colors.activeDot}`}></div>
      )}
      
      {/* Hover arrow indicator */}
      {!active && (
        <ChevronRight 
          size={14} 
          className="relative z-10 text-[#949ba4] opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0 -translate-x-1 transition-all duration-300" 
        />
      )}
    </button>
  );
}
