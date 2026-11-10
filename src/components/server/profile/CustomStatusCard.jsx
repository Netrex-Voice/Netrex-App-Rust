import { memo } from "react";

/**
 * ✅ CustomStatusCard - Isolated component
 * Re-renders only when custom status changes
 */
const CustomStatusCard = memo(({ customStatus, customStatusColor }) => {
  if (!customStatus) return null;

  return (
    <div className="relative overflow-hidden bg-[#1e1f22] p-3 rounded-xl border border-white/5 group/status">
      <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
      <p 
        className="text-sm text-[#dbdee1] leading-relaxed font-medium"
        style={{ color: customStatusColor || "inherit" }}
      >
        {customStatus}
      </p>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.customStatus === nextProps.customStatus &&
    prevProps.customStatusColor === nextProps.customStatusColor
  );
});

CustomStatusCard.displayName = 'CustomStatusCard';

export default CustomStatusCard;
