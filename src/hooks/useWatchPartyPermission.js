// src/hooks/useWatchPartyPermission.js
import { useMemo } from 'react';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { useAuthStore } from '@/src/store/authStore';
import { useServerPermission } from '@/src/hooks/useServerPermission';
import { WP_ROLES } from '@/src/constants/watchPartyConstants';

export function useWatchPartyPermission(serverId) {
  const currentUser = useAuthStore((s) => s.user);
  const hostId  = useWatchPartyStore((s) => s.hostId);
  const coHosts = useWatchPartyStore((s) => s.coHosts);
  const coHostPermissions = useWatchPartyStore((s) => s.coHostPermissions || {});

  // Mevcut sunucu yetki sisteminle entegre (MANAGE_SERVER or MANAGE_CHANNELS checks)
  const isServerAdmin = useServerPermission('MANAGE_SERVER');
  const isServerMod = useServerPermission('MANAGE_CHANNELS');
   // Yeni: Rollerden bağımsız Watch Party yetkisi
  const canManageWatchParty = useServerPermission('MANAGE_WATCH_PARTY');

  const permissions = useMemo(() => {
    const uid = currentUser?.uid;
    if (!uid) {
      return {
        role: WP_ROLES.MEMBER,
        canControl:     false,   // play/pause/seek/skip
        canManageTracks: false,  // parça ekle/sil
        canManageCoHosts: false, // co-host ekle/çıkar
        canEndParty:     false,  // party'yi bitir
        canVote:         true,   // herkes oy verebilir
      };
    }

    const isHost       = uid === hostId;
    const isCoHost     = coHosts.includes(uid);
    const coHostPerm   = coHostPermissions?.[uid] || null;

    // Rol belirleme (öncelik sırası)
    let role = WP_ROLES.MEMBER;
    if (isHost)                      role = WP_ROLES.HOST;
    else if (isServerAdmin)          role = WP_ROLES.ADMIN;
    else if (isServerMod)            role = WP_ROLES.MODERATOR;
    else if (isCoHost)               role = WP_ROLES.CO_HOST;

    const canControlFromCoHost =
      isCoHost && !!coHostPerm?.canControlPlayback;
    const canManageTracksFromCoHost =
      isCoHost && !!coHostPerm?.canManageTracks;

    const hasAnyTrackControl =
      isHost || isServerAdmin || isServerMod || canManageWatchParty || canControlFromCoHost;

    const hasAnyTrackManage =
      isHost || isServerAdmin || isServerMod || canManageWatchParty || canManageTracksFromCoHost;

    return {
      role,
      canControl:       hasAnyTrackControl,
      canManageTracks:  hasAnyTrackManage,
      canManageCoHosts: isHost || isServerAdmin || canManageWatchParty,
      canEndParty:      isHost || isServerAdmin || canManageWatchParty,
      canStartParty:    isHost || isServerAdmin || canManageWatchParty,
      canVote:          true,
    };
  }, [currentUser?.uid, hostId, coHosts, coHostPermissions, isServerAdmin, isServerMod, canManageWatchParty]);

  return permissions;
}
