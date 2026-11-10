import React, { useMemo } from "react";
import { useParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import UserCard from "./UserCard";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useServerStore } from "@/src/store/serverStore";
import { useVoiceGroupStore, VOICE_GROUPS, DEFAULT_GROUP_ID } from "@/src/store/voiceGroupStore";
import { GroupSectionFrame, GroupsToolbar } from "./VoiceGroupsUI";

const gridClassFor = (count) => {
  if (count === 1) return "grid-cols-1 w-full max-w-[800px] aspect-video max-h-[600px]";
  if (count === 2) return "grid-cols-1 md:grid-cols-2 w-full max-w-[1000px] gap-5";
  if (count <= 4) return "grid-cols-2 w-full max-w-[900px] gap-5";
  if (count <= 6) return "grid-cols-2 md:grid-cols-3 w-full max-w-[1100px] gap-4";
  return "grid-cols-3 md:grid-cols-4 w-full max-w-[1200px] gap-4";
};

// Grup kutusu içinde kartlar daha küçük olmalı: en fazla 2 sütun
const sectionGridClassFor = (count) =>
  count === 1 ? "grid-cols-1 w-full gap-3" : "grid-cols-1 sm:grid-cols-2 w-full gap-3";

// --- KATILIMCI LİSTESİ ---
const ParticipantList = React.memo(({
  onUserContextMenu,
  compact,
  hideIncomingVideo,
  setPinnedStreamIds,
  pinnedStreamIds,
}) => {
  const participants = useParticipants();
  const count = participants.length;

  const disableAnimations = useSettingsStore(s => s.disableAnimations);
  const graphicsQuality = useSettingsStore(s => s.graphicsQuality);

  // 🎙️ Konuşma grupları: kullanılıyorsa kartlar renkli grup kutularına ayrılır
  const assignments = useVoiceGroupStore(s => s.assignments);
  const localIdentity = useVoiceGroupStore(s => s.localIdentity);
  const groupsInUse = Object.keys(assignments).length > 0;

  // ✅ OPTIMIZATION: useTracks'i parent'ta BİR KEZ çağır (N kez yerine)
  const allScreenShareTracks = useTracks([Track.Source.ScreenShare]);
  const allCameraTracks = useTracks([Track.Source.Camera]);

  // ✅ Map'e dönüştür - O(1) lookup (O(N) find yerine)
  const screenShareTrackMap = useMemo(() => {
    const map = new Map();
    allScreenShareTracks.forEach(t => map.set(t.participant.sid, t));
    return map;
  }, [allScreenShareTracks]);

  const cameraTrackMap = useMemo(() => {
    const map = new Map();
    allCameraTracks.forEach(t => map.set(t.participant.sid, t));
    return map;
  }, [allCameraTracks]);

  // ✅ OPTIMIZATION: members'ı parent'ta bir kez al
  const members = useServerStore(s => s.members);

  // Potato/Low quality: Animasyon yok
  const shouldAnimate = !disableAnimations &&
                        graphicsQuality !== 'potato' &&
                        graphicsQuality !== 'low';

  // ✅ Memoized grid class
  const gridClass = useMemo(() => gridClassFor(count), [count]);

  // Gruplara böl (üyesi olan gruplar + benim grubum her zaman görünür)
  const sections = useMemo(() => {
    if (!groupsInUse) return null;
    const myGroupId = assignments[localIdentity] ?? DEFAULT_GROUP_ID;
    return VOICE_GROUPS
      .map((group) => ({
        group,
        isMine: group.id === myGroupId,
        members: participants.filter((p) => (assignments[p.identity] ?? DEFAULT_GROUP_ID) === group.id),
      }))
      .filter((s) => s.members.length > 0 || s.isMine);
  }, [groupsInUse, assignments, localIdentity, participants]);

  if (count === 0) return null;

  const cardProps = {
    totalCount: count,
    hideIncomingVideo,
    setPinnedStreamIds,
    pinnedStreamIds,
    screenShareTrackMap,
    cameraTrackMap,
    members,
  };

  // Gruplar açıkken kartlar başka gruba geçince yeni yerine süzülsün (paylaşılan layoutId; "position" = videoyu germez)
  const sharedLayout = (p) => (sections ? { layout: "position", layoutId: `vg-card-${p.identity}` } : {});

  // Tek bir kartı (animasyonlu/animasyonsuz) çiz
  const renderCard = (p, isCompact) => {
    const card = (
      <UserCard
        participant={p}
        onContextMenu={(e) => onUserContextMenu(e, p)}
        compact={isCompact || undefined}
        {...cardProps}
      />
    );

    if (isCompact) {
      return shouldAnimate ? (
        <motion.div
          key={p.sid}
          {...sharedLayout(p)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
          className="min-w-[140px] h-full"
          style={{ overflow: "visible", padding: "2px" }}
        >
          {card}
        </motion.div>
      ) : (
        <div key={p.sid} className="min-w-[140px] h-full" style={{ overflow: "visible", padding: "2px" }}>
          {card}
        </div>
      );
    }

    return shouldAnimate ? (
      <motion.div
        key={p.sid}
          {...sharedLayout(p)}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
        className="w-full h-full aspect-[16/9] min-h-[180px]"
        style={{ overflow: "visible", padding: "4px" }}
      >
        {card}
      </motion.div>
    ) : (
      <div key={p.sid} className="w-full h-full aspect-[16/9] min-h-[180px]" style={{ overflow: "visible", padding: "4px" }}>
        {card}
      </div>
    );
  };

  const wrapList = (list, isCompact) =>
    shouldAnimate ? <AnimatePresence mode="sync">{list.map((p) => renderCard(p, isCompact))}</AnimatePresence> : list.map((p) => renderCard(p, isCompact));

  // ── 🎙️ Gruplar açıkken: renkli grup kutuları ──
  if (sections) {
    if (compact) {
      return (
        <LayoutGroup id="vg-cards">
          <div className="flex items-stretch gap-3 h-full px-2" style={{ overflow: "visible" }}>
            {sections.map((s) => (
              <GroupSectionFrame key={s.group.id} group={s.group} isMine={s.isMine} count={s.members.length} compact>
                <div className="flex items-center gap-3 h-full" style={{ overflow: "visible" }}>
                  {wrapList(s.members, true)}
                </div>
              </GroupSectionFrame>
            ))}
          </div>
        </LayoutGroup>
      );
    }

    return (
      <LayoutGroup id="vg-cards">
        <div className="w-full max-h-full overflow-y-auto custom-scrollbar p-2">
          <GroupsToolbar />
          <div className="flex flex-wrap items-stretch justify-center gap-4 w-full">
            {sections.map((s) => (
              <GroupSectionFrame key={s.group.id} group={s.group} isMine={s.isMine} count={s.members.length}>
                <div
                  className={`grid ${sectionGridClassFor(s.members.length)} items-center justify-center content-center`}
                  style={{ overflow: "visible" }}
                >
                  {wrapList(s.members, false)}
                </div>
              </GroupSectionFrame>
            ))}
          </div>
        </div>
      </LayoutGroup>
    );
  }

  // ── Normal görünüm (gruplar kullanılmıyor) ──
  if (compact) {
    return (
      <div className="flex items-center gap-3 h-full px-2" style={{ overflow: "visible" }}>
        {wrapList(participants, true)}
      </div>
    );
  }

  return (
    <div
      className={`grid ${gridClass} items-center justify-center content-center w-full p-4`}
      style={{ overflow: "visible" }} // Glow efektlerinin kesilmemesi için
    >
      {wrapList(participants, false)}
    </div>
  );
});

export default ParticipantList;
