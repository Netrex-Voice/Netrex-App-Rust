"use client";

import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useMemo, useState, useEffect, useCallback, memo, useRef } from "react";
import { X, Users, Crown, Shield } from "lucide-react";
import MemberContextMenu from "@/src/components/server/MemberContextMenu";
import UserProfileModal from "@/src/components/server/UserProfileModal";
import MemberItem from "@/src/components/server/MemberItem";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import { db } from "@/src/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  documentId,
} from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import ServerMemberListSkeleton from "@/src/components/server/skeletons/ServerMemberListSkeleton";
import { useRtdbPresenceWatch } from "@/src/lib/rtdbPresence";
import { useShallow } from "zustand/react/shallow";

// İki üye nesnesi yüzeysel olarak aynı mı? Aynıysa eski referans korunur ve MemberItem'ın memo'su işe yarar.
function shallowEqualObj(a, b) {
  if (a === b) return true;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

// Kullanıcı profilleri (durum, aktivite, son görülme) panel kapanıp açılınca ve sunucular arasında geçişte
// anında dolsun diye bellekte tutulur. Aksi halde liste her açılışta herkesi "Çevrimdışı" gösterip sonra
// profiller gelince tek tek yerine atlatıyordu.
const PROFILE_CACHE = new Map(); // uid -> profil

const RoleIcon = memo(({ roleId, roleName }) => {
  const lowerName = roleName?.toLowerCase() || "";
  if (
    lowerName.includes("owner") ||
    lowerName.includes("sahip") ||
    lowerName.includes("kurucu") ||
    roleId === "owner"
  ) {
    return <Crown size={12} className="text-amber-400 fill-amber-400/20" />;
  }
  if (
    lowerName.includes("admin") ||
    lowerName.includes("yönetici") ||
    lowerName.includes("moderator")
  ) {
    return <Shield size={12} className="text-indigo-400 fill-indigo-400/20" />;
  }
  return null;
});
RoleIcon.displayName = "RoleIcon";

const HeaderRow = memo(({ item }) => (
  <div className="flex items-center px-4 pt-3 pb-1">
    <div className="flex items-center gap-2 flex-1 group/header cursor-default">
      <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wide flex items-center gap-2 flex-1">
        <RoleIcon roleId={item.roleId} roleName={item.roleName} />
        <span
          className="transition-colors group-hover/header:text-[#dbdee1]"
          style={{
            color:
              !item.isOffline && item.roleId !== "uncategorized"
                ? item.roleColor
                : undefined,
          }}
        >
          {item.roleName}
        </span>
      </div>
    </div>
  </div>
));
HeaderRow.displayName = "HeaderRow";

export default function ServerMemberList({ onClose }) {
  // Seçicisiz useServerStore() sesli kanala biri girip çıkınca (voiceStates değişince) bile tüm listeyi yeniden çiziyordu
  const { members, roles, currentServer, isLoading } = useServerStore(
    useShallow((s) => ({
      members: s.members,
      roles: s.roles,
      currentServer: s.currentServer,
      isLoading: s.isLoading,
    })),
  );
  const currentUser = useAuthStore((s) => s.user);
  // Kendi profileColor'ımızı da okuyoruz (local user için fallback)
  const localProfileColor = useSettingsStore((s) => s.profileColor);

  const [contextMenu, setContextMenu] = useState(null);
  const [profileModal, setProfileModal] = useState(null);
  const [userProfiles, setUserProfiles] = useState(() => {
    const initial = {};
    (useServerStore.getState().members || []).forEach((m) => {
      const id = m.id || m.userId;
      if (id && PROFILE_CACHE.has(id)) initial[id] = PROFILE_CACHE.get(id);
    });
    return initial;
  });
  // İlk profil verisi gelene kadar listeyi göstermiyoruz (iskelet). { serverId, ready }: sunucu değişince
  // yeniden beklenir; aynı sunucuda biri katılıp ayrılınca liste yeniden iskelete dönmez.
  const [profilesReady, setProfilesReady] = useState(() => {
    const state = useServerStore.getState();
    const ms = state.members || [];
    const covered = ms.length > 0 && ms.every((m) => PROFILE_CACHE.has(m.id || m.userId));
    return { serverId: state.currentServer?.id || null, ready: covered };
  });
  // "Eskidi" (bayat presence) hesabı zamana bağlı: kimse bir şey yazmasa da periyodik yeniden hesapla.
  // Aksi halde kullanıcılar ancak başka bir güncelleme gelince, hep birlikte toplu atlıyordu.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // ✅ FIX: Stable member ID key - listener sadece ÜYE SAYISI/ID'LERİ değişince yeniden bağlanır.
  // Daha önce: [members] dep → Firestore snapshot her members güncellemesinde listener'ı teardown/rebuild yapıyordu.
  // Şimdi: ID listesi değişmediği sürece (presence/profil güncelleme) listener sabit kalıyor.
  // 🟢 Üyelerin anlık bağlantı durumu (kopanlar anında çevrimdışı görünür). Değişince liste yeniden hesaplanır.
  const memberUidList = useMemo(() => (members || []).map((m) => m.id || m.userId).filter(Boolean), [members]);
  const livePresenceVersion = useRtdbPresenceWatch(memberUidList);

  const memberIdsKey = useMemo(() => {
    if (!members || members.length === 0) return "";
    return members
      .map((m) => m.id || m.userId)
      .filter(Boolean)
      .sort()
      .join(",");
  }, [members]);

  useEffect(() => {
    if (!memberIdsKey) return;

    const memberIds = memberIdsKey.split(",");
    if (memberIds.length === 0) return;

    // Firestore `in` sorgusu en fazla 30 değer alır. Daha önce yalnızca ilk 30 üye
    // (ID'ye göre sıralı) dinleniyordu; büyük sunucularda diğerlerinin durumu hiç güncellenmiyordu.
    // Üyeleri 30'luk parçalara böl, her parça için bir listener aç ve sonuçları birleştir.
    const CHUNK_SIZE = 30;
    const chunkProfiles = [];
    const unsubscribes = [];
    const totalChunks = Math.ceil(memberIds.length / CHUNK_SIZE);
    const chunkLoaded = [];
    let loadedChunks = 0;
    const serverId = useServerStore.getState().currentServer?.id || null;

    // Hazır mı? Aynı sunucuda zaten hazırsa öyle kalır; yeni sunucuda yalnızca tüm profiller önbellekteyse.
    const covered = memberIds.every((id) => PROFILE_CACHE.has(id));
    setProfilesReady((prev) => ({
      serverId,
      ready: (prev.serverId === serverId && prev.ready) || covered,
    }));

    // Parçalar ayrı ayrı gelir (150 üyede 5 parça). Her biri için liste baştan hesaplanıp çizilmesin:
    // iskelet görünürken tüm parçalar gelene kadar bekle, sonra TEK seferde yaz; liste zaten görünürken gelen
    // güncellemeleri de kare başına tek yazıma birleştir.
    let listVisible = covered;
    let flushRaf = null;
    const flushProfiles = () => {
      flushRaf = null;
      setUserProfiles(Object.assign({}, ...chunkProfiles));
    };
    const scheduleFlush = () => {
      if (flushRaf == null) flushRaf = requestAnimationFrame(flushProfiles);
    };

    for (let i = 0; i < memberIds.length; i += CHUNK_SIZE) {
      const chunkIndex = i / CHUNK_SIZE;
      const chunkIds = memberIds.slice(i, i + CHUNK_SIZE);
      // Önbellekteki profillerle başla: ilk snapshot gelene kadar mevcut bilgiler kaybolmasın
      chunkProfiles[chunkIndex] = Object.fromEntries(
        chunkIds.filter((id) => PROFILE_CACHE.has(id)).map((id) => [id, PROFILE_CACHE.get(id)]),
      );

      const q = query(
        collection(db, "users"),
        where(documentId(), "in", chunkIds),
      );

      unsubscribes.push(
        onSnapshot(
          q,
          (snapshot) => {
            const profiles = {};
            snapshot.docs.forEach((doc) => {
              const data = doc.data();
              profiles[doc.id] = {
                gameActivity: data.gameActivity || null,
                customStatus: data.customStatus || null,
                customStatusColor: data.customStatusColor || null,
                presence: data.presence || null,
                lastSeen: data.lastSeen || null,
                profileColor: data.profileColor || null,
                photoURL: data.photoURL ?? null,
              };
            });
            Object.entries(profiles).forEach(([id, p]) => PROFILE_CACHE.set(id, p));
            chunkProfiles[chunkIndex] = profiles;
            if (!chunkLoaded[chunkIndex]) {
              chunkLoaded[chunkIndex] = true;
              loadedChunks += 1;
            }
            if (listVisible) {
              scheduleFlush();
            } else if (loadedChunks >= totalChunks) {
              // İlk yükleme tamamlandı: profilleri tek seferde yaz, iskeleti kaldır
              listVisible = true;
              if (flushRaf != null) {
                cancelAnimationFrame(flushRaf);
                flushRaf = null;
              }
              setUserProfiles(Object.assign({}, ...chunkProfiles));
              setProfilesReady({ serverId, ready: true });
            }
          },
          (error) => {
            console.error("User profiles listener error:", error);
            setProfilesReady({ serverId, ready: true }); // hata olsa da liste sonsuza dek iskelette kalmasın
          },
        ),
      );
    }

    return () => {
      if (flushRaf != null) cancelAnimationFrame(flushRaf);
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [memberIdsKey]); // ✅ Sadece üye ID'leri değişince yeniden bağlan

  const profileModalTimeoutRef = useRef(null);
  const contextMenuTimeoutRef = useRef(null);

  const handleMemberClick = useCallback((e, member) => {
    e.stopPropagation();
    if (profileModalTimeoutRef.current)
      clearTimeout(profileModalTimeoutRef.current);
    profileModalTimeoutRef.current = setTimeout(() => {
      setProfileModal({ member, position: { x: e.clientX, y: e.clientY } });
    }, 100);
  }, []);

  const handleMemberContextMenu = useCallback((e, member) => {
    e.preventDefault();
    if (contextMenuTimeoutRef.current)
      clearTimeout(contextMenuTimeoutRef.current);
    contextMenuTimeoutRef.current = setTimeout(() => {
      setContextMenu({ x: e.clientX, y: e.clientY, member });
    }, 50);
  }, []);

  useEffect(() => {
    return () => {
      if (profileModalTimeoutRef.current)
        clearTimeout(profileModalTimeoutRef.current);
      if (contextMenuTimeoutRef.current)
        clearTimeout(contextMenuTimeoutRef.current);
    };
  }, []);

  // ✅ enrichedMembers - profileColor kaynağı: Firestore users > member doc > local store (sadece kendi)
  // Önceki hesabın nesneleri: içerik değişmediyse AYNI referans döner, böylece MemberItem'ın memo'su işe yarar
  // (aksi halde her hesapta yüzlerce satır gereksiz yeniden render oluyordu).
  const enrichedCacheRef = useRef(new Map());
  const enrichedMembers = useMemo(() => {
    const prevCache = enrichedCacheRef.current;
    const nextCache = new Map();
    const list = members.map((member) => {
      const memberId = member.id || member.userId;
      const userProfile = userProfiles[memberId] || {};
      const isCurrentUser =
        currentUser &&
        (member.id === currentUser.uid || member.userId === currentUser.uid);
      const effectivePresence = getEffectivePresence(
        {
          ...member,
          ...userProfile,
        },
        nowTick,
      );

      // profileColor öncelik sırası:
      // 1. Firestore users dokümanı (en güncel)
      // 2. member dokümanındaki profileColor
      // 3. Kendi local store'umuz (sadece local kullanıcı için)
      const profileColor =
        userProfile.profileColor ||
        member.profileColor ||
        (isCurrentUser ? localProfileColor : null);

      // photoURL: Firestore users dokümanı her zaman member doc'tan daha güncel
      const photoURL =
        "photoURL" in userProfile
          ? userProfile.photoURL
          : member.photoURL || (isCurrentUser ? currentUser.photoURL : null);

      const enriched = {
        ...member,
        displayName:
          member.displayName ||
          member.nickname ||
          (isCurrentUser
            ? currentUser.displayName
            : `User${member.id?.slice(-4) || ""}`),
        photoURL,
        profileColor,
        presence: effectivePresence,
        gameActivity: userProfile.gameActivity,
        customStatus: userProfile.customStatus || member.customStatus,
        customStatusColor: userProfile.customStatusColor,
      };
      const prev = prevCache.get(memberId);
      const result = prev && shallowEqualObj(prev, enriched) ? prev : enriched;
      nextCache.set(memberId, result);
      return result;
    });
    enrichedCacheRef.current = nextCache;
    return list;
  }, [members, currentUser, userProfiles, localProfileColor, nowTick, livePresenceVersion]);

  const groupedMembers = useMemo(() => {
    if (!enrichedMembers || !roles || !currentServer) return {};
    const sortedRoles = [...roles].sort(
      (a, b) => (b.order || 0) - (a.order || 0),
    );

    const groups = {};
    groups["owner"] = {
      role: { name: "Sunucu Kurucusu", color: "#f59e0b", id: "owner" },
      members: [],
    };
    sortedRoles.forEach((role) => {
      groups[role.id] = { role, members: [] };
    });
    groups["uncategorized"] = {
      role: { name: "Çevrimiçi", color: "#949ba4", id: "uncategorized" },
      members: [],
    };
    groups["offline"] = {
      role: { name: "Çevrimdışı", color: "#4e5058", id: "offline" },
      members: [],
    };

    enrichedMembers.forEach((member) => {
      if (member.presence === "offline") {
        groups["offline"].members.push(member);
        return;
      }
      if (
        member.id === currentServer.ownerId ||
        member.userId === currentServer.ownerId
      ) {
        groups["owner"].members.push(member);
        return;
      }

      let assigned = false;
      if (member.roles?.length > 0) {
        for (const role of sortedRoles) {
          if (member.roles.includes(role.id)) {
            groups[role.id].members.push(member);
            assigned = true;
            break;
          }
        }
      }
      if (!assigned) groups["uncategorized"].members.push(member);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].members.sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );
      if (groups[key].members.length === 0) delete groups[key];
    });
    return groups;
  }, [enrichedMembers, roles, currentServer]);

  const flatData = useMemo(() => {
    if (!roles) return [];

    const ids = [];
    if (groupedMembers?.["owner"]) ids.push("owner");
    const roleIds = [...roles]
      .sort((a, b) => (b.order || 0) - (a.order || 0))
      .map((r) => r.id);
    ids.push(...roleIds, "uncategorized", "offline");

    const items = [];
    ids
      .filter((id) => groupedMembers?.[id])
      .forEach((key) => {
        const group = groupedMembers[key];
        items.push({
          type: "header",
          roleId: key,
          roleName: group.role.name,
          roleColor: group.role.color,
          count: group.members.length,
          isOffline: key === "offline",
        });
        group.members.forEach((member) => {
          items.push({
            type: "member",
            member,
            roleId: key,
            roleColor: group.role.color,
            isOfflineGroup: key === "offline",
          });
        });
      });
    return items;
  }, [groupedMembers, roles]);

  const rowContent = useCallback(
    (index, item) => {
      if (item.type === "header") return <HeaderRow item={item} />;
      return (
        <div className="px-2 py-[2px]">
          <div
            className={
              item.isOfflineGroup
                ? "opacity-60 hover:opacity-100 transition-opacity duration-300"
                : ""
            }
          >
            <MemberItem
              member={item.member}
              roleId={item.roleId}
              roleColor={item.roleColor}
              isOfflineGroup={item.isOfflineGroup}
              onClick={handleMemberClick}
              onContextMenu={handleMemberContextMenu}
            />
          </div>
        </div>
      );
    },
    [handleMemberClick, handleMemberContextMenu],
  );

  if (!currentServer) return null;

  // İlk veri gelene kadar iskelet: herkesi önce "Çevrimdışı" gösterip sonra yerine atlatmak yerine
  const waitingForProfiles =
    members.length > 0 && !(profilesReady.serverId === currentServer.id && profilesReady.ready);
  if ((members.length === 0 && isLoading) || waitingForProfiles) {
    return <ServerMemberListSkeleton onClose={onClose} />;
  }

  return (
    <div className="w-full h-full bg-[#111214] flex flex-col relative overflow-hidden border-l border-white/[0.06]">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/[0.03] blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-500/[0.02] blur-[60px] pointer-events-none" />

      <div className="flex items-center justify-between px-4 h-16 shrink-0 bg-[#111214]/80 backdrop-blur-xl border-b border-white/[0.06] relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
            <Users size={16} className="text-[#949ba4]" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Üyeler
            </h3>
            <span className="text-[10px] text-[#949ba4] font-medium">
              {members.length} Kişi
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#949ba4] hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative z-10 overflow-y-auto overflow-x-hidden p-2 space-y-0.5 scrollbar-thin scrollbar-thumb-[#2b2d31] scrollbar-track-transparent">
        {flatData.map((item, idx) => (
          <div
            key={item.type === "header" ? `header-${item.roleId}` : (item.member?.id || item.member?.userId || idx)}
            // Ekran dışındaki satırların yerleşim/boyama maliyetini atlar (yüzlerce üyede belirgin kazanç)
            style={{ contentVisibility: "auto", containIntrinsicSize: "auto 44px" }}
          >
            {rowContent(idx, item)}
          </div>
        ))}
      </div>

      {contextMenu && (
        <MemberContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          member={contextMenu.member}
          onClose={() => setContextMenu(null)}
        />
      )}
      {profileModal && (
        <UserProfileModal
          member={profileModal.member}
          position={profileModal.position}
          onClose={() => setProfileModal(null)}
        />
      )}
    </div>
  );
}
