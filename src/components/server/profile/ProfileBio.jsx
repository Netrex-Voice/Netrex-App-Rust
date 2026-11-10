import { memo } from "react";

/**
 * ✅ ProfileBio - Isolated component
 * Re-renders only when bio changes
 */
const ProfileBio = memo(({ bio }) => {
  if (!bio) return null;

  return (
    <div>
      <h4 className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5">Hakkında</h4>
      <div className="bg-[#1e1f22]/50 rounded-xl p-3 border border-white/5">
        <p className="text-[13px] text-[#dbdee1] leading-relaxed whitespace-pre-wrap">
          {bio}
        </p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.bio === nextProps.bio;
});

ProfileBio.displayName = 'ProfileBio';

export default ProfileBio;
