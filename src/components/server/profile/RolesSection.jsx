import { memo } from "react";

/**
 * ✅ RolesSection - Isolated component
 * Re-renders only when roles array changes
 */
const RolesSection = memo(({ memberRoles }) => {
  if (!memberRoles || memberRoles.length === 0) return null;

  return (
    <div>
      <h4 className="text-[11px] font-bold text-[#949ba4] uppercase mb-2">Roller</h4>
      <div className="flex flex-wrap gap-1.5">
        {memberRoles.map((role) => (
          <div 
            key={role.id} 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1e1f22] border border-white/5 hover:border-white/10 hover:bg-[#25272a] transition-colors cursor-default"
          >
            <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ color: role.color, backgroundColor: role.color }}></div>
            <span className="text-xs text-[#dbdee1] font-medium">{role.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.memberRoles?.length === nextProps.memberRoles?.length &&
    prevProps.memberRoles?.every((role, idx) => role.id === nextProps.memberRoles[idx]?.id)
  );
});

RolesSection.displayName = 'RolesSection';

export default RolesSection;
