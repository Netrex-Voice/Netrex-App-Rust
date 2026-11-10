"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, ChevronRight, Zap, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/src/store/authStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useUpdateStore } from "@/src/store/updateStore";
import { createPortal } from "react-dom";
import { useServerStore } from "@/src/store/serverStore";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";

export default function RailUserPanel() {
  const { user } = useAuthStore();
  const isMuted = useSettingsStore((s) => s.isMuted);
  const isDeafened = useSettingsStore((s) => s.isDeafened);
  const toggleMute = useSettingsStore((s) => s.toggleMute);
  const toggleDeaf = useSettingsStore((s) => s.toggleDeaf);
  const userStatus = useSettingsStore((s) => s.userStatus);
  const setUserStatus = useSettingsStore((s) => s.setUserStatus);
  // ✅ settingsStore'dan oku - üyeler listesiyle aynı kaynak
  const profileColor = useSettingsStore((s) => s.profileColor);
  // ✅ Firestore member dokümanındaki rengi de kontrol et (üyeler listesiyle tam senkron)
  const members = useServerStore((s) => s.members);
  const memberProfileColor = members?.find(
    (m) => m.id === user?.uid || m.userId === user?.uid,
  )?.profileColor;
  // Firestore'daki değer varsa onu kullan, yoksa store'dakini
  const effectiveProfileColor = memberProfileColor || profileColor || "#6366f1";
  const { status: updateStatus } = useUpdateStore();

  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 20, left: 0 });
  const containerRef = useRef(null);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        !e.target.closest("[data-rail-menu]")
      ) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAvatarClick = (e) => {
    e.stopPropagation();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuPos({
        // Bir tık daha aşağı ve profile (raile) yakın
        bottom: window.innerHeight - rect.top - 48, 
        left: rect.right + 8,
      });
    }
    setShowMenu((v) => !v);
  };

  // gradient gelirse ilk hex rengi çıkar (avatar bg için)
  const solidProfileColor = (() => {
    if (!effectiveProfileColor) return "#6366f1";
    if (effectiveProfileColor.includes("gradient")) {
      const m = effectiveProfileColor.match(/#[0-9a-fA-F]{6}/);
      return m ? m[0] : "#6366f1";
    }
    return effectiveProfileColor;
  })();

  // Status config
  const statusConfig = {
    online: {
      color: "bg-emerald-500",
      shadow: "shadow-[0_0_10px_rgba(16,185,129,0.6)]",
      label: "Çevrimiçi",
    },
    idle: {
      color: "bg-amber-400",
      shadow: "shadow-[0_0_10px_rgba(251,191,36,0.6)]",
      label: "Uzakta",
    },
    dnd: {
      color: "bg-red-500",
      shadow: "shadow-[0_0_10px_rgba(239,68,68,0.6)]",
      label: "Rahatsız Etme",
    },
    invisible: {
      color: "bg-indigo-500",
      shadow: "shadow-[0_0_10px_rgba(99,102,241,0.6)]",
      label: "Görünmez",
    },
    offline: { color: "bg-gray-500", shadow: "", label: "Çevrimdışı" },
  };
  const currentStatus = statusConfig[userStatus] || statusConfig.offline;


  return (
    <>
      <div
        ref={containerRef}
        className="mt-auto pb-6 pt-2 w-full flex flex-col items-center gap-4 relative z-50"
      >
        {/* Dekoratif Ayırıcı */}
        <div className="w-8 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent flex-shrink-0" />

        {/* Avatar Trigger */}
        <button
          onClick={handleAvatarClick}
          className={`group relative w-12 h-12 transition-all duration-300 ${
            showMenu ? "scale-105" : "hover:scale-105"
          }`}
        >
          {/* Glow */}
          <div
            className="absolute inset-0 rounded-[18px] blur-md transition-opacity duration-300"
            style={{
              background: solidProfileColor,
              opacity: showMenu ? 0.3 : 0,
            }}
          />
          <div
            className="absolute inset-0 rounded-[18px] blur-md opacity-0 group-hover:opacity-20 transition-opacity duration-300"
            style={{ background: solidProfileColor }}
          />

          {/* Container */}
          <div
            className={`relative w-full h-full rounded-[18px] overflow-hidden border-2 transition-all duration-300 ${
              showMenu
                ? "shadow-lg"
                : "border-white/5 group-hover:border-white/20"
            }`}
            style={{
              borderColor: showMenu ? solidProfileColor + "80" : undefined,
              boxShadow: showMenu
                ? `0 0 15px ${solidProfileColor}40`
                : undefined,
            }}
          >
            <div className="absolute inset-0 bg-[#313338]" />

            <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-lg z-10">
              <UserPhoto
                uid={user?.uid}
                src={user?.photoURL}
                alt={user?.displayName || "Avatar"}
                className="w-full h-full object-cover"
                fallback={
                  <AvatarFallback
                    name={user?.displayName}
                    color={effectiveProfileColor}
                    className="w-full h-full"
                    textClassName="text-lg font-bold"
                  />
                }
              />
            </div>
          </div>

          {/* Status dot */}
          <div
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-xl border-[3px] border-[#1e1f22] z-20 
              ${currentStatus.color} ${currentStatus.shadow} transition-all duration-300`}
          />

          {/* Update badge */}
          {updateStatus === "downloaded" && (
            <div className="absolute -top-1 -left-1 w-5 h-5 bg-emerald-500 rounded-xl border-[3px] border-[#1e1f22] z-30 flex items-center justify-center animate-bounce shadow-[0_0_10px_rgba(16,185,129,0.5)]">
              <Zap size={8} className="text-white fill-white" />
            </div>
          )}
        </button>
      </div>

      {/* Popup Menu */}
      {showMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-rail-menu
            className="fixed z-[9999] w-72 rounded-xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-2 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-left-4 duration-200"
            style={{
              left: menuPos.left,
              bottom: menuPos.bottom,
              background: "rgba(17,18,20,0.92)",
              backdropFilter: "blur(20px)",
            }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient glow */}
            <div
              className="absolute top-0 right-0 w-32 h-32 blur-[50px] pointer-events-none opacity-20"
              style={{ background: solidProfileColor }}
            />

            {/* User Header - üyeler listesiyle aynı stil */}
            <div className="relative p-3 mb-2 rounded-xl bg-white/5 border border-white/5 overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-lg border border-white/10">
                  <UserPhoto
                    uid={user?.uid}
                    src={user?.photoURL}
                    alt={user?.displayName || "Avatar"}
                    className="w-full h-full object-cover"
                    fallback={
                      <AvatarFallback
                        name={user?.displayName}
                        color={effectiveProfileColor}
                        className="w-full h-full"
                        textClassName="text-lg font-bold"
                      />
                    }
                  />
                </div>

                {/* Bilgi */}
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-[15px] truncate leading-tight">
                    {user?.displayName || "Misafir"}
                  </span>
                  <span
                    className="text-xs font-medium truncate mt-0.5"
                    style={{ color: solidProfileColor }}
                  >
                    Netrex ID: #{user?.uid?.slice(0, 4) || "0000"}
                  </span>
                </div>
              </div>
            </div>

            {/* Durum başlık */}
            <div className="px-3 py-1.5 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
              Durum Ayarla
            </div>

            {/* Durum seçenekleri */}
            <div className="space-y-1 mb-2">
              {[
                {
                  id: "online",
                  label: "Çevrimiçi",
                  color: "bg-emerald-500",
                  shadow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                },
                {
                  id: "idle",
                  label: "Uzakta",
                  color: "bg-amber-400",
                  shadow: "shadow-[0_0_8px_rgba(251,191,36,0.5)]",
                },
                {
                  id: "invisible",
                  label: "Görünmez",
                  color: "bg-indigo-500",
                  shadow: "shadow-[0_0_8px_rgba(99,102,241,0.5)]",
                },
                {
                  id: "offline",
                  label: "Çevrimdışı",
                  color: "bg-gray-500",
                  shadow: "",
                },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserStatus(s.id);
                    setShowMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group ${
                    userStatus === s.id
                      ? "bg-white/10 text-white shadow-inner"
                      : "text-[#949ba4] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-xl ${s.color} ${s.shadow} group-hover:scale-110 transition-transform`}
                  />
                  <span className="text-sm font-medium">{s.label}</span>
                  {userStatus === s.id && (
                    <div className="ml-auto w-1.5 h-1.5 bg-white rounded-xl opacity-50 shadow-[0_0_5px_white]" />
                  )}
                </button>
              ))}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />

            {/* Ayarlar */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                useSettingsStore.getState().setSettingsOpen(true);
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-[#dbdee1] hover:text-white transition-all group"
            >
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 text-indigo-400 transition-colors">
                <Settings size={16} />
              </div>
              <span className="text-sm font-medium">Uygulama Ayarları</span>
              <ChevronRight
                size={14}
                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0"
              />
            </button>

            {/* Güncelleme butonu */}
            {updateStatus === "downloaded" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.netrex) window.netrex.quitAndInstall();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 mt-1 transition-all group"
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <RefreshCw size={16} className="animate-spin-slow" />
                </div>
                <span className="text-sm font-bold">Yeni Sürümü Kur</span>
                <Zap size={14} className="ml-auto animate-pulse" />
              </button>
            )}
          </div>,
          document.body,
        )}

      <style jsx global>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </>
  );
}
