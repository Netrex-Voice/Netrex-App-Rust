import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParticipants, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Split, Merge, Megaphone, Ear, MicOff, Info, Reply, X, Headphones } from "lucide-react";
import {
  useVoiceGroupStore,
  VOICE_GROUPS,
  DEFAULT_GROUP_ID,
  TALK_MODES,
  getGroupMeta,
} from "@/src/store/voiceGroupStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { moveToGroup, mergeAllGroups, startTalk, endTalk, startWhisper } from "@/src/hooks/useVoiceGroups";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";

/**
 * 🎙️ Konuşma Grupları arayüzü
 *  - VoiceGroupsControl : alt çubuktaki düğme + grup paneli
 *  - CardTalkStatus     : kartın kenarına bitişik durum (fısıldıyorsun / yanıtın ona gidiyor / sana fısıldıyor)
 *  - TalkHud            : sadece yedek: konuşulan kişinin kartı ekranda yoksa üstte küçük bildirim; Herkese/Gruba modları da burada
 *  - GroupChip          : kullanıcı kartında grup rozeti
 *  - WhisperHold        : kulak simgesi, basılı tutunca sadece o kişiye konuşulur
 */

const WHISPER_COLOR = "#a855f7"; // mor — fısıltı her yerde aynı renk
const ALL_COLOR = "#f59e0b"; // turuncu — herkese duyuru

const parseMeta = (p) => {
  try {
    return p?.metadata ? JSON.parse(p.metadata) : {};
  } catch {
    return {};
  }
};

/** Odada gruplar kullanılıyor mu? (herkes Grup 1'deyse arayüz sade kalır) */
const useGroupsInUse = () =>
  useVoiceGroupStore((s) => Object.keys(s.assignments).length > 0);

// ──────────────────────────────────────
// Basılı tut mantığı (tüm "basılı tutarak konuş" düğmeleri bunu kullanır)
// Takılı kalmasın diye: pencere odağı kaybolursa, işaretçi yakalama bozulursa veya bileşen sökülürse bırakılır.
// ──────────────────────────────────────
function useHold(onStart) {
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);

  const release = useCallback(() => {
    if (!heldRef.current) return;
    heldRef.current = false;
    setHeld(false);
    endTalk();
  }, []);

  useEffect(() => {
    if (!held) return;
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, [held, release]);

  useEffect(() => release, [release]); // sökülürken basılı kalmışsa bırak

  const stop = (e) => e.stopPropagation();
  const handlers = {
    onPointerDown: (e) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      heldRef.current = true;
      setHeld(true);
      onStart();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
    onClick: stop,
    onDoubleClick: stop,
    onMouseDown: stop,
    onContextMenu: (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
  };
  return { held, handlers };
}

// ──────────────────────────────────────
// "Basılı tutarak konuş" düğmesi — oda görünümünde grup kutusunun altında ve araç çubuğunda
// active: kısayol tuşuyla da basılıysa (store'dan) aynı şekilde yanar
// ──────────────────────────────────────
function TalkHoldButton({ talk, color, icon: Icon, label, heldLabel, active = false, variant = "bar", title }) {
  const { held, handlers } = useHold(() => startTalk(talk));
  const on = held || active;
  const isBar = variant === "bar";

  return (
    <button
      type="button"
      title={title}
      {...handlers}
      className={`group/hold relative overflow-hidden select-none touch-none flex items-center justify-center gap-2 font-bold text-white transition duration-150 ${
        isBar ? "w-full h-10 rounded-xl text-xs" : "h-8 px-3 rounded-full text-[11px]"
      } ${on ? "scale-[0.98]" : "hover:brightness-125 active:scale-[0.98]"}`}
      style={{
        background: on ? color : `${color}26`,
        border: `1px solid ${on ? color : `${color}77`}`,
        boxShadow: on ? `0 0 22px ${color}88, inset 0 0 12px rgba(255,255,255,0.15)` : "none",
      }}
    >
      {on && <span className="absolute inset-0 animate-pulse" style={{ background: `${color}33` }} />}
      <Icon size={isBar ? 16 : 13} className="relative shrink-0" />
      <span className="relative truncate">{on ? heldLabel || label : label}</span>
      {!on && isBar && <span className="relative text-[10px] font-medium text-white/50 hidden sm:inline">· basılı tut</span>}
    </button>
  );
}

// ──────────────────────────────────────
// Kişinin üstünde kulak simgesi: BASILI TUT → sadece o kişi duyar
// ──────────────────────────────────────
export function WhisperHold({ identity, size = "md", showLabel = false, className = "" }) {
  const { held, handlers } = useHold(() => startWhisper(identity));
  const dim = size === "sm" || size === "xs" ? "w-5 h-5" : "w-8 h-8";

  return (
    <button
      type="button"
      title="Basılı tut: sadece bu kişiye fısılda"
      {...handlers}
      className={`rounded-full flex items-center justify-center gap-1.5 shrink-0 select-none touch-none transition ${
        showLabel ? "px-3 h-8 text-xs font-bold" : dim
      } ${held ? "text-white scale-110" : "bg-black/50 text-white/80 hover:text-white hover:bg-black/70 border border-white/20"} ${className}`}
      style={held ? { background: WHISPER_COLOR, boxShadow: `0 0 16px ${WHISPER_COLOR}99` } : undefined}
    >
      <Ear size={size === "md" ? 15 : 11} />
      {showLabel && (held ? "Fısıldıyorsun…" : "Basılı tut: Fısılda")}
    </button>
  );
}

// ──────────────────────────────────────
// Panel: kişi çipi (sürüklenebilir; tıklayınca sonraki gruba geçer)
// ──────────────────────────────────────
function PersonChip({ participant, isLocal, onCycle }) {
  const meta = parseMeta(participant);
  const name = participant.name || meta.displayName || participant.identity;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", participant.identity);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onCycle}
      title="Sürükleyip bırak ya da tıkla: sonraki gruba taşır"
      className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full bg-black/30 border border-white/10 hover:border-white/30 hover:bg-black/50 cursor-grab active:cursor-grabbing select-none transition-colors max-w-full"
    >
      <UserPhoto
        uid={participant.identity}
        src={meta.photoURL}
        alt={name}
        className="w-6 h-6 rounded-full object-cover shrink-0"
        fallback={
          <AvatarFallback
            name={name}
            color={meta.profileColor}
            className="w-6 h-6 rounded-full shrink-0"
            textClassName="text-[9px] font-bold"
          />
        }
      />
      <span className="text-xs font-semibold text-white truncate">{isLocal ? `${name} (Sen)` : name}</span>
      {!isLocal && <WhisperHold identity={participant.identity} size="sm" />}
    </div>
  );
}

// ──────────────────────────────────────
// Panel: grup kutusu (kişi bırakılabilir)
// ──────────────────────────────────────
function GroupDropBox({ group, members, isMine, localParticipant, assignments }) {
  const [over, setOver] = useState(false);
  const nextGroupId = (id) => {
    const idx = VOICE_GROUPS.findIndex((g) => g.id === id);
    return VOICE_GROUPS[(idx + 1) % VOICE_GROUPS.length].id;
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const identity = e.dataTransfer.getData("text/plain");
        if (identity) moveToGroup(localParticipant, identity, group.id);
      }}
      className="rounded-xl border-2 p-2 transition"
      style={{
        borderColor: over ? group.color : `${group.color}${isMine ? "aa" : "44"}`,
        background: `${group.color}${over ? "24" : "10"}`,
        borderStyle: members.length === 0 ? "dashed" : "solid",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />
        <span className="text-xs font-bold text-white">{group.name}</span>
        <span className="text-[10px] text-[#949ba4]">{members.length} kişi</span>
        {isMine && (
          <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-md text-white" style={{ background: group.color }}>
            BURADASIN
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {members.length === 0 ? (
          <span className="text-[11px] text-[#5c5e66] px-1 py-1">Buraya sürükle</span>
        ) : (
          members.map((p) => (
            <PersonChip
              key={p.identity}
              participant={p}
              isLocal={p.isLocal}
              onCycle={() => moveToGroup(localParticipant, p.identity, nextGroupId(assignments[p.identity] ?? DEFAULT_GROUP_ID))}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────
// Oda görünümünde grup kutusu çerçevesi (ParticipantList kullanır)
// Altta büyük "basılı tut" çubuğu: başka bir gruba konuşmak için. Konuşurken kutu parlar.
// ──────────────────────────────────────
export function GroupSectionFrame({ group, isMine, count, compact, children }) {
  // Bu gruba (veya herkese) konuşuyor muyum? Kısayol tuşuyla da yansır.
  const talking = useVoiceGroupStore(
    (s) => (s.talk.mode === TALK_MODES.GROUP && s.talk.groupId === group.id) || s.talk.mode === TALK_MODES.ALL,
  );
  const lit = talking && !isMine;

  return (
    <div
      data-vg-group={group.id}
      className={`relative rounded-2xl border-2 flex flex-col transition duration-200 ${
        compact ? "p-2 min-w-0" : "p-3 flex-1 min-w-[300px] max-w-[760px]"
      }`}
      style={{
        borderColor: lit ? group.color : isMine ? group.color : `${group.color}66`,
        background: `${group.color}${lit ? "24" : isMine ? "14" : "0c"}`,
        boxShadow: lit ? `0 0 36px ${group.color}66` : isMine ? `0 0 28px ${group.color}30` : undefined,
      }}
    >
      <div className={`flex items-center gap-2 ${compact ? "mb-1" : "mb-2"} px-1`}>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: group.color }} />
        <span className={`font-bold text-white ${compact ? "text-[11px]" : "text-sm"}`}>{group.name}</span>
        <span className="text-[10px] text-[#949ba4]">{count} kişi</span>
        <div className="ml-auto flex items-center gap-1.5">
          {isMine && (
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-md text-white tracking-wide"
              style={{ background: group.color }}
            >
              BURADASIN
            </span>
          )}
          {/* Dar şeritte: küçük basılı tut düğmesi */}
          {!isMine && compact && (
            <TalkHoldButton
              variant="pill"
              talk={{ mode: TALK_MODES.GROUP, groupId: group.id }}
              color={group.color}
              icon={Megaphone}
              label="Konuş"
              heldLabel="…"
              active={talking}
              title={`Basılı tut: ${group.name} de seni duyar`}
            />
          )}
        </div>
      </div>

      {children}

      {/* Büyük basılı tut çubuğu (diğer gruplar için) */}
      {!isMine && !compact && (
        <div className="mt-3">
          <TalkHoldButton
            variant="bar"
            talk={{ mode: TALK_MODES.GROUP, groupId: group.id }}
            color={group.color}
            icon={Megaphone}
            label={`${group.name} ile konuş`}
            heldLabel={`${group.name} seni duyuyor`}
            active={talking}
            title={`Basılı tutunca ${group.name} de seni duyar, bırakınca kendi grubuna dönersin`}
          />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────
// Grup araç çubuğu (odanın üstünde): Herkese + Birleştir — gruplar kullanılırken görünür
// ──────────────────────────────────────
export function GroupsToolbar() {
  const { localParticipant } = useLocalParticipant();
  const talkingAll = useVoiceGroupStore((s) => s.talk.mode === TALK_MODES.ALL);

  return (
    <div
      data-vg-toolbar
      className="flex items-center gap-2 w-full max-w-[1100px] mx-auto mb-3 px-3 py-2 rounded-2xl bg-[#111214]/80 backdrop-blur-md border border-white/10"
    >
      <Split size={14} className="text-indigo-400 shrink-0" />
      <span className="text-xs font-bold text-white/90 shrink-0">Konuşma grupları</span>
      <span className="hidden md:inline text-[11px] text-[#949ba4] truncate">
        Aynı gruptakiler birbirini duyar · başka gruba konuşmak için kutudaki düğmeyi basılı tut
      </span>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <TalkHoldButton
          variant="pill"
          talk={{ mode: TALK_MODES.ALL, groupId: null }}
          color={ALL_COLOR}
          icon={Megaphone}
          label="Herkese"
          heldLabel="Herkes duyuyor"
          active={talkingAll}
          title="Basılı tutunca tüm gruplar seni duyar"
        />
        <button
          type="button"
          onClick={() => mergeAllGroups(localParticipant)}
          title="Herkesi tek grupta birleştir"
          className="h-8 px-3 rounded-full bg-white/5 border border-white/10 text-[#b5bac1] hover:text-white hover:bg-white/10 text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95"
        >
          <Merge size={13} />
          Birleştir
        </button>
      </div>
    </div>
  );
}


// ──────────────────────────────────────
// Başka bir grubu dinleme seviyesi (0 = duymam). Grup başına ayrı; kişi başı ses ayarlarının üstüne biner.
// ──────────────────────────────────────
function GroupListenSlider({ group }) {
  const value = useSettingsStore((s) => s.groupListenVolumes?.[group.id] ?? 0);
  const setValue = useSettingsStore((s) => s.setGroupListenVolume);

  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: group.color }} />
      <span className="text-[11px] text-[#b5bac1] w-14 shrink-0 truncate">{group.name}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => setValue(group.id, Number(e.target.value))}
        aria-label={`${group.name} dinleme sesi`}
        className="flex-1 h-1 cursor-pointer"
        style={{ accentColor: group.color }}
      />
      <span className="text-[10px] text-[#949ba4] tabular-nums w-8 text-right">
        {value === 0 ? "Kapalı" : `%${value}`}
      </span>
    </div>
  );
}

// ──────────────────────────────────────
// Alt çubuk düğmesi + panel
// ──────────────────────────────────────
export function VoiceGroupsControl() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const assignments = useVoiceGroupStore((s) => s.assignments);
  const inUse = useGroupsInUse();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const myId = localParticipant?.identity;
  const myGroupId = assignments[myId] ?? DEFAULT_GROUP_ID;
  const myGroup = getGroupMeta(myGroupId);

  const byGroup = useMemo(
    () =>
      VOICE_GROUPS.map((g) => ({
        group: g,
        members: participants.filter((p) => (assignments[p.identity] ?? DEFAULT_GROUP_ID) === g.id),
      })),
    [participants, assignments],
  );

  // Tek kişi varken anlamsız
  if (!room || participants.length < 2) return null;

  return (
    <div className="relative flex items-center" ref={wrapRef}>
      <div className="w-px h-8 bg-white/10 mx-1" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 relative active:scale-95 ${
          inUse
            ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500 hover:text-white hover:border-indigo-500"
            : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20"
        }`}
        title={inUse ? `Konuşma Grupları (Sen: ${myGroup.name})` : "Konuşma Grupları: Herkes birlikte"}
      >
        <Split size={20} className="sm:w-5 sm:h-5" />
        {inUse && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black text-white flex items-center justify-center border border-[#0e0f12]"
            style={{ background: myGroup.color }}
          >
            {myGroup.id}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-[99999] w-80 max-w-[92vw] animate-scaleIn origin-bottom bg-[#111214] border border-white/10 overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Başlık */}
          <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Split size={14} className="text-indigo-400" />
              <span className="text-xs font-bold text-white/90">Konuşma Grupları</span>
            </div>
            <p className="text-[11px] text-[#949ba4] mt-1 leading-snug">
              Kişileri gruplara <b className="text-white/80">sürükle</b> (ya da üstüne tıkla). Aynı gruptakiler birbirini duyar.
            </p>
          </div>

          {/* Gruplar */}
          <div className="p-2.5 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {byGroup.map(({ group, members }) => (
              <GroupDropBox
                key={group.id}
                group={group}
                members={members}
                isMine={group.id === myGroupId}
                localParticipant={localParticipant}
                assignments={assignments}
              />
            ))}
          </div>

          {/* Diğer grupları dinle: gruptan ayrılmadan, grup başına ayrı ses seviyesi */}
          {byGroup.some(({ group, members }) => group.id !== myGroupId && members.length > 0) && (
            <div className="px-3 py-2.5 border-t border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/80">
                <Headphones size={12} className="text-indigo-400" />
                Diğer grupları dinle
              </div>
              {byGroup
                .filter(({ group, members }) => group.id !== myGroupId && members.length > 0)
                .map(({ group }) => (
                  <GroupListenSlider key={group.id} group={group} />
                ))}
            </div>
          )}

          {/* Alt: birleştir + herkese */}
          <div className="px-3 py-3 border-t border-white/[0.06] bg-black/20 space-y-2">
            <div className="flex gap-2">
              {inUse && (
                <button
                  type="button"
                  onClick={() => mergeAllGroups(localParticipant)}
                  className="flex-1 h-8 rounded-full bg-white/5 border border-white/10 text-[#b5bac1] hover:text-white hover:bg-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Merge size={13} />
                  Birleştir
                </button>
              )}
              <div className="flex-1">
                <TalkHoldButton
                  variant="pill"
                  talk={{ mode: TALK_MODES.ALL, groupId: null }}
                  color={ALL_COLOR}
                  icon={Megaphone}
                  label="Herkese (basılı tut)"
                  heldLabel="Herkes duyuyor"
                  title="Basılı tutunca tüm gruplar seni duyar"
                />
              </div>
            </div>
            <p className="text-[10px] text-[#5c5e66] flex items-start gap-1.5 leading-snug">
              <Info size={11} className="shrink-0 mt-px" />
              Sadece birine söylemek için kişinin kartındaki <Ear size={10} className="inline -mt-0.5" /> simgesini basılı tut.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


// ──────────────────────────────────────
// Yedek gösterge: konuşulan kişinin kartı ekranda yoksa (örn. tam ekran yayın) üstte küçük bir bildirim
// Kart varsa gösterge kartın kendisinde görünür (bkz. CardTalkStatus), burada gösterilmez.
// ──────────────────────────────────────
const cardIsVisible = (identity) => {
  if (typeof document === "undefined" || !identity) return false;
  return !!document.querySelector(`[data-vg-card="${String(identity).replace(/"/g, '\\"')}"]`);
};

export function TalkHud() {
  const room = useRoomContext();
  const talk = useVoiceGroupStore((s) => s.talk);
  const whisperTargetId = useVoiceGroupStore((s) => s.whisperTargetId);
  const replyId = useVoiceGroupStore((s) => (s.talk.mode === TALK_MODES.NORMAL ? s.replyTo?.id : null));
  const isMuted = useSettingsStore((s) => s.isMuted);
  const isDeafened = useSettingsStore((s) => s.isDeafened);

  const replying = !!replyId && talk.mode === TALK_MODES.NORMAL;
  if (talk.mode === TALK_MODES.NORMAL && !replying) return null;

  let color = ALL_COLOR;
  let Icon = Megaphone;
  let title = "Herkese konuşuyorsun";
  let sub = "Odadaki herkes seni duyuyor";

  // Grup kutusu / araç çubuğu ekrandaysa gösterge orada yanar; burada tekrarlama
  if (talk.mode === TALK_MODES.ALL && document.querySelector("[data-vg-toolbar]")) return null;
  if (talk.mode === TALK_MODES.GROUP && document.querySelector(`[data-vg-group="${talk.groupId}"]`)) return null;

  if (talk.mode === TALK_MODES.GROUP) {
    const g = getGroupMeta(talk.groupId);
    color = g.color;
    title = `${g.name}'a da konuşuyorsun`;
    sub = `Kendi grubun ve ${g.name} seni duyuyor`;
  } else if (talk.mode === TALK_MODES.WHISPER || replying) {
    const id = replying ? replyId : whisperTargetId;
    // Kart ekrandaysa gösterge kartta; burada tekrarlama
    if (cardIsVisible(id)) return null;
    const target = room?.remoteParticipants?.get(id);
    color = WHISPER_COLOR;
    Icon = Ear;
    title = replying ? `Yanıtın ${target?.name || "ona"}'e gidiyor` : `${target?.name || "Seçili kişi"}'e fısıldıyorsun`;
    sub = "Sadece o seni duyuyor";
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9990] pointer-events-none animate-scaleIn">
      <div
        className="flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-2xl bg-[#111214]/95 backdrop-blur-md border shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        style={{ borderColor: `${color}80`, boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 24px ${color}40` }}
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: color }} />
          <div
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: color }}
          >
            <Icon size={18} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white leading-tight">{title}</div>
          <div className="text-[11px] text-[#b5bac1] leading-tight">{sub}</div>
        </div>
        {(isMuted || isDeafened) && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold">
            <MicOff size={11} />
            Mikrofon kapalı
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────
// Kullanıcı kartı rozetleri
// ──────────────────────────────────────

/** İsmin yanında küçük grup rozeti (gruplar kullanılmıyorsa görünmez) */
export function GroupChip({ identity, compact }) {
  const inUse = useGroupsInUse();
  const groupId = useVoiceGroupStore((s) => s.assignments[identity] ?? DEFAULT_GROUP_ID);
  if (!inUse) return null;
  const g = getGroupMeta(groupId);
  return (
    <span
      className={`shrink-0 rounded-md font-black text-white leading-none ${compact ? "text-[8px] px-1 py-0.5" : "text-[9px] px-1.5 py-0.5"}`}
      style={{ background: g.color }}
      title={g.name}
    >
      {compact ? g.id : g.name}
    </span>
  );
}

/**
 * Kartın kenarına bitişik konuşma durumu: renkli çerçeve + üst kenardan sarkan etiket.
 *  - Ben bu kişiye fısıldıyorum (basılı tutarken)      → "Sadece o duyuyor"
 *  - Bu kişi bana fısıldadı, yanıtım ona gidiyor        → "Yanıtın sadece ona gidiyor" (+ geri sayım, ✕ ile iptal)
 *  - Bu kişi bana fısıldıyor / gruba / herkese konuşuyor → "Sana fısıldıyor" vb.
 */
export function CardTalkStatus({ identity, compact }) {
  const incoming = useVoiceGroupStore((s) => s.incoming[identity]);
  const speakerGroup = useVoiceGroupStore((s) => s.assignments[identity] ?? DEFAULT_GROUP_ID);
  const myGroup = useVoiceGroupStore((s) =>
    s.localIdentity ? (s.assignments[s.localIdentity] ?? DEFAULT_GROUP_ID) : DEFAULT_GROUP_ID,
  );
  const holdingWhisper = useVoiceGroupStore(
    (s) => s.talk.mode === TALK_MODES.WHISPER && s.whisperTargetId === identity,
  );
  // Elle basılı tuş yokken ve yanıt bu kişiye gidiyorsa bitiş zamanı (Infinity = o hâlâ fısıldıyor)
  const replyUntil = useVoiceGroupStore((s) =>
    s.talk.mode === TALK_MODES.NORMAL && s.replyTo?.id === identity ? s.replyTo.until : null,
  );

  // Geri sayım için saniyede ~2 kez yenile (sadece sonlu yanıt penceresi varken)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (replyUntil === null || replyUntil === Infinity) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [replyUntil]);

  let status = null;
  if (holdingWhisper) {
    status = { color: WHISPER_COLOR, Icon: Ear, text: "Sadece o duyuyor", live: true };
  } else if (replyUntil !== null) {
    const left = replyUntil === Infinity ? null : Math.max(0, Math.ceil((replyUntil - Date.now()) / 1000));
    status = {
      color: WHISPER_COLOR,
      Icon: Reply,
      text: "Yanıtın sadece ona gidiyor",
      countdown: left,
      cancelable: true,
      live: true,
    };
  } else if (incoming) {
    const whisper = incoming.mode === TALK_MODES.WHISPER;
    // Aynı gruptaki biri "herkese/gruba" konuşuyorsa zaten normal duyuyorum; sadece farklı gruptakini göster
    if (whisper || speakerGroup !== myGroup) {
      status = {
        color: whisper ? WHISPER_COLOR : ALL_COLOR,
        Icon: whisper ? Ear : Megaphone,
        text: whisper ? "Sana fısıldıyor" : incoming.mode === TALK_MODES.ALL ? "Herkese konuşuyor" : "Gruba konuşuyor",
        live: true,
      };
    }
  }

  if (!status) return null;
  const { color, Icon, text, countdown, cancelable } = status;

  return (
    <>
      {/* Kartı çevreleyen çerçeve */}
      <div
        className="absolute inset-0 rounded-xl border-2 pointer-events-none z-30 animate-scaleIn"
        style={{ borderColor: color, boxShadow: `inset 0 0 28px ${color}30, 0 0 20px ${color}40` }}
      />
      {/* Üst kenara bitişik etiket */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 text-white font-bold rounded-b-xl shadow-lg ${
          compact ? "px-2 py-0.5 text-[9px]" : "px-3.5 py-1 text-[11px]"
        }`}
        style={{ background: color, boxShadow: `0 4px 14px ${color}66` }}
      >
        <Icon size={compact ? 10 : 13} />
        <span className="whitespace-nowrap">{text}</span>
        {typeof countdown === "number" && (
          <span className="opacity-80 tabular-nums">{countdown}sn</span>
        )}
        {cancelable && (
          <button
            type="button"
            title="Yanıtı herkese döndür"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              useVoiceGroupStore.getState().setReplyTo(null);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="ml-0.5 w-4 h-4 rounded-full bg-black/25 hover:bg-black/50 flex items-center justify-center transition-colors"
          >
            <X size={10} />
          </button>
        )}
      </div>
    </>
  );
}
