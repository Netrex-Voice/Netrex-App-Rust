import { memo, useState, useCallback } from "react";
import { Shield, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * ✅ RoleItem - Single role component
 * Memoized - sadece kendi role veya hasRole değişince re-render
 */
const RoleItem = memo(({ role, hasRole, isLoading, onToggle }) => {
  return (
    <button
      onClick={() => onToggle(role.id)}
      disabled={isLoading}
      className={`
        w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border group/role
        ${hasRole 
          ? 'bg-[#1e1f22] border-indigo-500/30 text-white shadow-sm' 
          : 'text-[#949ba4] border-transparent hover:bg-white/5 hover:text-gray-200'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div 
          className={`w-2 h-2 rounded-full flex-shrink-0 transition-shadow duration-300 ${hasRole ? 'shadow-[0_0_8px_currentColor]' : ''}`}
          style={{ backgroundColor: role.color || '#949ba4', color: role.color || '#949ba4' }}
        />
        <span className="truncate">{role.name}</span>
      </div>
      
      <div className={`
        w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200
        ${hasRole ? 'bg-indigo-500 text-white scale-100' : 'bg-white/5 text-transparent scale-90 group-hover/role:scale-100 group-hover/role:bg-white/10'}
      `}>
        <Check size={10} strokeWidth={3} />
      </div>
    </button>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.role.id === nextProps.role.id &&
    prevProps.hasRole === nextProps.hasRole &&
    prevProps.isLoading === nextProps.isLoading
  );
});

RoleItem.displayName = 'RoleItem';

/**
 * ✅ RolesList - Isolated roles accordion
 * State isolation - showRoles değişimi sadece bu component'i etkiler
 */
const RolesList = memo(({ 
  sortedRoles, 
  memberRoles, 
  onToggleRole,
  canManageRoles 
}) => {
  const [showRoles, setShowRoles] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleRole = useCallback(async (roleId) => {
    if (isLoading) return;
    setIsLoading(true);
    await onToggleRole(roleId);
    setIsLoading(false);
  }, [isLoading, onToggleRole]);

  if (!canManageRoles) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowRoles(!showRoles)}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
          ${showRoles 
            ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-white border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
            : 'text-[#949ba4] hover:text-white hover:bg-white/5 border border-transparent'
          }
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showRoles ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-[#949ba4] group-hover:text-white'}`}>
              <Shield size={14} />
          </div>
          <span>Roller</span>
        </div>
        <ChevronRight 
          size={14} 
          className={`transform transition-transform duration-300 ${showRoles ? 'rotate-90 text-indigo-400' : 'text-[#6b7280]'}`}
        />
      </button>

      {showRoles && (
        <div className="mt-2 mb-1 pl-2 space-y-1 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 animate-in slide-in-from-top-2 duration-200">
          <div className="px-1 space-y-1">
            {sortedRoles.length === 0 ? (
              <div className="text-xs text-[#6b7280] px-3 py-2 italic text-center border border-dashed border-white/5 rounded-lg">Rol bulunamadı</div>
            ) : (
              sortedRoles.map(role => {
                const hasRole = memberRoles.includes(role.id);
                return (
                  <RoleItem
                    key={role.id}
                    role={role}
                    hasRole={hasRole}
                    isLoading={isLoading}
                    onToggle={handleToggleRole}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render only if roles or memberRoles change
  return (
    prevProps.sortedRoles.length === nextProps.sortedRoles.length &&
    prevProps.memberRoles.length === nextProps.memberRoles.length &&
    prevProps.canManageRoles === nextProps.canManageRoles
  );
});

RolesList.displayName = 'RolesList';

export default RolesList;
