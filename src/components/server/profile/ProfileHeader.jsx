import { memo } from "react";
import { Crown, Edit3, MoreHorizontal } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";

const ProfileHeader = memo(
  ({
    member,
    userProfile,
    effectivePresence,
    isOwnProfile,
    isOwner,
    memberBadges,
    onEditProfile,
    bannerColor,
    profileBgImage,
    nameColor,
  }) => {
    // profileColor → hem avatar arka planı hem border
    const effectiveColor =
      member.profileColor || member.color || userProfile?.profileColor || null;

    return (
      <>
        {/* Banner Section */}
        <div className="h-[130px] relative w-full group/banner bg-[#1e1f22]">
          {profileBgImage ? (
            <>
              <img
                src={profileBgImage}
                className="absolute inset-0 w-full h-full object-cover"
                alt="banner"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] via-transparent to-black/30" />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{ background: bannerColor }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#0f0f11]/80" />
            </>
          )}

          {/* Actions */}
          <div className="absolute top-3 right-3 flex gap-2 z-20">
            {isOwnProfile ? (
              <button
                onClick={onEditProfile}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-md flex items-center justify-center border border-white/10 transition-all hover:scale-105"
                title="Profili Düzenle"
              >
                <Edit3 size={14} />
              </button>
            ) : (
              <button className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-md flex items-center justify-center border border-white/10 transition-all">
                <MoreHorizontal size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Avatar & Badges */}
        <div className="px-5 relative z-10 -mt-[54px] mb-3">
          <div className="flex justify-between items-end">
            <div className="relative group/avatar">
              <Avatar
                uid={member.id || member.userId}
                src={member.photoURL || userProfile?.photoURL}
                name={member.displayName}
                size="xl"
                status={effectivePresence}
                color={effectiveColor}
                borderColor={effectiveColor}
                className="ring-[4px] ring-[#0f0f11] rounded-xl relative z-10 transition-transform duration-300 group-hover/avatar:scale-[1.02]"
              />
              {isOwner && (
                <div className="absolute -top-1 -right-1 z-20 bg-[#0f0f11] rounded-full p-1 ring-2 ring-[#0f0f11]">
                  <div className="bg-gradient-to-br from-amber-300 to-amber-600 rounded-full p-1 shadow-lg shadow-amber-500/40">
                    <Crown size={12} className="text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Badges */}
            {memberBadges.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5 mb-2 max-w-[150px]">
                {memberBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="w-8 h-8 rounded-xl bg-[#1e1f22] border border-white/10 flex items-center justify-center hover:scale-110 transition-transform cursor-help shadow-md relative overflow-hidden group/badge"
                    title={badge.name}
                  >
                    <div
                      className="absolute inset-0 opacity-20 group-hover/badge:opacity-40 transition-opacity"
                      style={{ backgroundColor: badge.color }}
                    />
                    {badge.icon ? (
                      <badge.icon
                        size={15}
                        color={badge.color}
                        className="relative z-10"
                      />
                    ) : (
                      <img
                        src={badge.iconUrl}
                        className="w-4 h-4 object-contain relative z-10"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="px-5 mb-4">
          <h3
            className="text-[22px] font-bold leading-tight flex items-center gap-2"
            style={{ color: nameColor }}
          >
            {member.displayName}
          </h3>
          <p className="text-sm font-medium text-[#949ba4]">
            @{member.displayName?.toLowerCase().replace(/\s/g, "")}
          </p>
        </div>
      </>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.member.photoURL === nextProps.member.photoURL &&
      prevProps.member.displayName === nextProps.member.displayName &&
      prevProps.member.profileColor === nextProps.member.profileColor && // ✅ eklendi
      prevProps.userProfile?.photoURL === nextProps.userProfile?.photoURL &&
      prevProps.userProfile?.profileColor ===
        nextProps.userProfile?.profileColor && // ✅ eklendi
      prevProps.effectivePresence === nextProps.effectivePresence &&
      prevProps.isOwnProfile === nextProps.isOwnProfile &&
      prevProps.isOwner === nextProps.isOwner &&
      prevProps.memberBadges.length === nextProps.memberBadges.length &&
      prevProps.bannerColor === nextProps.bannerColor &&
      prevProps.profileBgImage === nextProps.profileBgImage &&
      prevProps.nameColor === nextProps.nameColor
    );
  },
);

ProfileHeader.displayName = "ProfileHeader";

export default ProfileHeader;
