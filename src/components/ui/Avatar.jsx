"use client";

/**
 * 👤 Avatar - User Avatar Component
 * NDS v2.1 - border → box-shadow (dışa doğru, avatarı küçültmez)
 */

import { forwardRef, useState } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAvatarUrl } from "@/src/hooks/useAvatarUrl";

const AVATAR_COLORS = [
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#eab308",
  "#14b8a6",
  "#ef4444",
  "#8b5cf6",
];

const getColorFromString = (str) => {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name, maxChars = 2) => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return parts
    .slice(0, maxChars)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
};

/**
 * Fotoğraf yokken gösterilen TEK yedek görünüm: profil rengi (varsa) yoksa isimden türetilen sabit renk + baş harfler.
 * Eskiden her ekran kendi yedeğini çiziyordu (profil gradyanı, düz gri, yarı saydam indigo…): aynı kişi her yerde
 * farklı renkte görünüyordu. Şekli/boyutu çağıran verir (className).
 */
export function AvatarFallback({ name, color, className = "", textClassName = "" }) {
  return (
    <div
      className={`flex items-center justify-center font-semibold text-white select-none ${className}`}
      style={{ background: color || getColorFromString(name) }}
    >
      <span className={textClassName}>{getInitials(name)}</span>
    </div>
  );
}

const Avatar = forwardRef(function Avatar(
  {
    src: srcProp,
    uid, // verilirse fotoğraf Firestore'dan CANLI çözülür (srcProp yalnızca ilk an / yedek)
    alt,
    name,
    size = "md",
    status,
    speaking = false,
    muted = false,
    deafened = false,
    color,
    borderColor,
    borderless = false,
    className = "",
    onImageLoad,
    ...props
  },
  ref,
) {
  const useProfileColorForSpeaking = useSettingsStore((s) => s.useProfileColorForSpeaking ?? true);
  const avatarColor = color || getColorFromString(name);

  // Güncel adres (canlı) + yükleme hatası ADRESE bağlı state'te. Eskiden onError elle DOM'u gizliyordu ve adres
  // düzelse bile resim bir daha görünmüyordu (silinen resim → Google'a dönüş "rastgele renge" takılıyordu).
  const liveSrc = useAvatarUrl(uid, srcProp);
  const [failedSrc, setFailedSrc] = useState(null);
  const src = liveSrc && failedSrc !== liveSrc ? liveSrc : null;

  // Gradient → ilk hex rengi al
  let effectiveBorderColor = borderColor;
  if (effectiveBorderColor?.includes("gradient")) {
    const match = effectiveBorderColor.match(/#[0-9a-fA-F]{6}/);
    effectiveBorderColor = match ? match[0] : undefined;
  }

  // ✅ box-shadow ile DIŞA doğru border - avatarın boyutunu etkilemez
  const toBorderShadow = (base) => {
    if (!base) return `0 0 0 2.5px rgba(255,255,255,0.12)`;
    if (base.startsWith("#")) {
      const r = parseInt(base.slice(1, 3), 16);
      const g = parseInt(base.slice(3, 5), 16);
      const b = parseInt(base.slice(5, 7), 16);
      return `0 0 0 2.5px rgba(${r},${g},${b},0.55)`;
    }
    return `0 0 0 2.5px rgba(255,255,255,0.12)`;
  };

  const initials = getInitials(name);

  const sizeConfig = {
    xs: {
      avatar: "w-5 h-5",
      text: "text-[8px]",
      status: "w-2 h-2",
      statusRing: "w-2.5 h-2.5",
    },
    sm: {
      avatar: "w-6 h-6",
      text: "text-[9px]",
      status: "w-2.5 h-2.5",
      statusRing: "w-3 h-3",
    },
    md: {
      avatar: "w-8 h-8",
      text: "text-small",
      status: "w-2.5 h-2.5",
      statusRing: "w-3.5 h-3.5",
    },
    lg: {
      avatar: "w-10 h-10",
      text: "text-body",
      status: "w-3 h-3",
      statusRing: "w-4 h-4",
    },
    xl: {
      avatar: "w-16 h-16",
      text: "text-h4",
      status: "w-4 h-4",
      statusRing: "w-5 h-5",
    },
    "2xl": {
      avatar: "w-24 h-24",
      text: "text-h2",
      status: "w-5 h-5",
      statusRing: "w-6 h-6",
    },
  };

  const config = sizeConfig[size] || sizeConfig.md;

  const getStatusColor = () => {
    if (status === "online") return "bg-nds-online";
    if (status === "offline") return "bg-nds-offline";
    if (status === "invisible") return "bg-nds-invisible";
    if (status === "dnd") return "bg-nds-danger";
    if (status === "idle") return "bg-nds-warning";
    return null;
  };

  const statusColor = getStatusColor();

  return (
    <div ref={ref} className={`relative inline-flex ${className}`} {...props}>
      {/* Avatar Container */}
      <div
        className={`
          ${config.avatar}
          rounded-lg
          flex items-center justify-center
          overflow-hidden
          flex-shrink-0
          font-semibold text-white
          transition-all duration-normal
          ${muted || deafened ? "opacity-50 grayscale" : ""}
        `}
        style={{
          background: !src ? avatarColor : undefined,
          // ✅ box-shadow dışa doğru - border yerine
          boxShadow: borderless ? "none" : toBorderShadow(effectiveBorderColor || avatarColor),
        }}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name}
            className="w-full h-full object-cover"
            // CORS yalnızca canvas okuması gerekirse (onImageLoad). Google (lh3) fotoğrafları CORS başlığı
            // göndermez: crossOrigin ile istenirse yükleme hata verip harf/gradyan yedeğine düşüyordu.
            crossOrigin={onImageLoad ? "anonymous" : undefined}
            referrerPolicy="no-referrer"
            onLoad={onImageLoad}
            onError={() => setFailedSrc(liveSrc)}
          />
        ) : null}

        {!src && (
          <span className={`avatar-fallback ${config.text}`}>
            {initials}
          </span>
        )}
      </div>

      {/* Status Indicator */}
      {statusColor && (
        <div
          className={`
            absolute -bottom-0.5 -right-0.5
            ${config.statusRing}
            bg-nds-bg-primary
            rounded-full
            flex items-center justify-center
          `}
        >
          <div className={`${config.status} rounded-full ${statusColor}`} />
        </div>
      )}

      {/* Speaking Ring */}
      {/* ✅ CPU OPT: boxShadow kaldırıldı - sadece border (GPU-composited) */}
      <div
        className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-200 ease-in-out ${speaking ? "opacity-100" : "opacity-0"}`}
        style={{
          borderColor: useProfileColorForSpeaking ? (effectiveBorderColor || avatarColor) : "#22c55e",
          borderWidth: "2px",
          borderStyle: "solid",
        }}
      />
    </div>
  );
});

export default Avatar;

// ── AvatarGroup ──────────────────────────────────────────────────────────────
export function AvatarGroup({
  avatars = [],
  max = 4,
  size = "md",
  className = "",
}) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const offsetStyles = {
    xs: "-ml-1.5",
    sm: "-ml-2",
    md: "-ml-2.5",
    lg: "-ml-3",
    xl: "-ml-4",
    "2xl": "-ml-6",
  };

  return (
    <div className={`flex items-center ${className}`}>
      {visible.map((avatar, index) => (
        <div
          key={avatar.id || index}
          className={`${index > 0 ? offsetStyles[size] : ""} ring-2 ring-nds-bg-primary rounded-lg`}
        >
          <Avatar
            src={avatar.src}
            name={avatar.name}
            status={avatar.status}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div className={offsetStyles[size]}>
          <div
            className={`
              ${
                size === "xs"
                  ? "w-5 h-5 text-[8px]"
                  : size === "sm"
                    ? "w-6 h-6 text-[9px]"
                    : size === "md"
                      ? "w-8 h-8 text-small"
                      : size === "lg"
                        ? "w-10 h-10 text-body"
                        : "w-16 h-16 text-h4"
              }
              rounded-lg bg-nds-bg-elevated flex items-center justify-center text-nds-text-tertiary font-medium
            `}
          >
            +{remaining}
          </div>
        </div>
      )}
    </div>
  );
}
