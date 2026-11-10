"use client";

/**
 * 🏗️ AppShell - Main Layout Wrapper (OPTIMIZED)
 * NDS v2.0 - Netrex Design System
 * 
 * The root layout component that provides structure for the entire application.
 * Includes: Sidebar, Main Content Area
 * 
 * OPTIMIZATION: useGameActivity hook removed - it should only run when connected to a room
 */

import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useAuthStore } from "@/src/store/authStore";
import { useServerStore } from "@/src/store/serverStore";
import { useLayoutStore } from "@/src/store/layoutStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSoundManagerStore } from "@/src/store/soundManagerStore";
import { toast } from "@/src/utils/toast";
import ErrorBoundary from "@/src/components/ui/ErrorBoundary";

// 📱 Mobile Components
import MobileDrawer from "@/src/components/layout/MobileDrawer";
import MobileNavBar from "@/src/components/layout/MobileNavBar";
import MobileServerSelector from "@/src/components/layout/MobileServerSelector";

const SettingsModal = lazy(() => import("@/src/components/SettingsModal"));

export default function AppShell({ 
  children, 
  sidebar,
  rightSidebar,
  rightSidebarKey,
  serverRail,
  hasRightSidebarContent = false,
  className = "",
  // 📱 Mobile props
  friendsMode = false,
  onGoHome,
  onToggleFriendsMode,
  onOpenCreateModal,
  messengerBadge = 0,
}) {

  const [isElectron, setIsElectron] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  // 📱 Mobile drawer states
  const [mobileServerDrawer, setMobileServerDrawer] = useState(false);
  const [mobileChannelDrawer, setMobileChannelDrawer] = useState(false);
  const mobileMemberDrawerOpen = useServerStore(state => state.mobileMemberDrawerOpen);
  const setMobileMemberDrawerOpen = useServerStore(state => state.setMobileMemberDrawerOpen);
  // ── Sunucu değişince üye paneli "Üye listesini gizle"ye basılmış gibi kapanır, içerik kapalıyken değişir,
  // sonra yeniden açılır. Kullanıcının kendi aç/kapa tercihi (showMemberList) bundan etkilenmez.
  // renderKey: şu an ekranda gösterilen sunucu; anahtar farklıysa kapanma süresince ESKİ içerik dondurulur.
  const [renderKey, setRenderKey] = useState(rightSidebarKey);
  const [closingForSwitch, setClosingForSwitch] = useState(false);
  const lastRightNodeRef = useRef(rightSidebar);
  const isCurrentServer = !renderKey || rightSidebarKey === renderKey;
  if (isCurrentServer) lastRightNodeRef.current = rightSidebar;
  const rightNode = isCurrentServer ? rightSidebar : lastRightNodeRef.current;

  useEffect(() => {
    if (rightSidebarKey === renderKey) return;
    if (!renderKey) {
      // Panel zaten boştaydı (ana sayfa): kapanmayı bekleme, doğrudan aç
      setRenderKey(rightSidebarKey);
      return;
    }
    setClosingForSwitch(true);
    // Kapanma animasyonu (0.32 sn) bitince yeni sunucuya geç ve yeniden aç
    const t = setTimeout(() => {
      setRenderKey(rightSidebarKey);
      setClosingForSwitch(false);
    }, 330);
    return () => clearTimeout(t);
  }, [rightSidebarKey, renderKey]);

  // Üye listesi görünürlüğü depoda: değişince Home yeniden render olmaz (bkz. layoutStore)
  const showRightSidebar = useLayoutStore((s) => s.showMemberList);
  const panelOpen = hasRightSidebarContent && showRightSidebar && !closingForSwitch;
  const onToggleRightSidebar = useLayoutStore((s) => s.toggleMemberList);
  const setShowMemberList = useLayoutStore((s) => s.setShowMemberList);
  const user = useAuthStore((s) => s.user);
  const { currentServer, members, isLoading, isLeavingServer } = useServerStore(
    useShallow((s) => ({
      currentServer: s.currentServer,
      members: s.members,
      isLoading: s.isLoading,
      isLeavingServer: s.isLeavingServer,
    })),
  );
  const showSettingsModal = useSettingsStore(state => state.showSettingsModal);
  const setSettingsOpen = useSettingsStore(state => state.setSettingsOpen);
  
  // 🚀 OPTIMIZATION: useGameActivity hook kaldırıldı
  // Oyun algılama electron/main.js tarafından otomatik yapılıyor
  // ve sadece odaya bağlanıldığında Firebase'e yazılıyor (useGameActivity.js içinde)

  // Real-time Kick/Ban Enforcement
  useEffect(() => {
    // Only run check if:
    // 1. We have a current server selected
    // 2. Loading is finished
    // 3. We have members loaded (to avoid false positives during initial load)
    // 4. We have a logged in user
    // 5. User is NOT voluntarily leaving (isLeavingServer flag)
    if (currentServer && !isLoading && members.length > 0 && user && !isLeavingServer) {
        const isMember = members.some(m => m.id === user.uid || m.userId === user.uid);
        
        // If user is not in the member list AND is not the owner (safety check)
        if (!isMember && currentServer.ownerId !== user.uid) {
             console.log("User removed from member list, redirecting to home.");
             router.push('/');
             // Use a unique ID to prevent toast spam if effect runs multiple times quickly
             toast.error("Bu sunucudan uzaklaştırıldınız.", { id: 'kick-notification' });
        }
    }
  }, [currentServer, members, user, isLoading, isLeavingServer, router]);

  useEffect(() => {
    const electronCheck = typeof window !== "undefined" && !!window.netrex;
    setIsElectron(electronCheck);

    // 📱 Mobil ekran kontrolü (sadece web'de)
    if (!electronCheck) {
      const checkMobile = () => setIsMobile(window.innerWidth <= 768);
      checkMobile();
      window.addEventListener("resize", checkMobile);
      // Cleanup
      const originalCleanup = () => window.removeEventListener("resize", checkMobile);
      // Store cleanup for later
      window.__netrexMobileCleanup = originalCleanup;
    }

    // 🚀 v5.3: Sistem seslerini RAM'e ön-yükle (Zero Latency)
    // ✅ FIX: 3sn geciktir - auth init ve Firestore onSnapshot ile yarışmasın
    const soundInitDelay = setTimeout(() => {
      useSoundManagerStore.getState().init();
    }, 3000);

    // 🎹 Global Hotkey Listener (Sadece Global Olanlar: TTS vs)
    // ⚠️ Mute, deafen, camera, quick-status gibi odaya özel şeyler BottomControls.js'de dinlenir!
    let cleanupTriggered;
    if (window.netrex) {
      cleanupTriggered = window.netrex.onHotkeyTriggered((action) => {
        // inputManager olayı "toggle-<eylem>" olarak gönderir
        if (action === "toggle-tts-stop") {
          window.speechSynthesis?.cancel();
          const evt = new CustomEvent("netrex-tts-state", { detail: { active: false, text: "" } });
          window.dispatchEvent(evt);
          toast.info("TTS durduruldu.");
        } else if (action === "toggle-tts-toggle") {
          const sStore = useSettingsStore.getState();
          useSettingsStore.setState({ ttsEnabled: !sStore.ttsEnabled });
          const newState = !sStore.ttsEnabled;
          if (!newState) {
            window.speechSynthesis?.cancel(); // Kapanıyorsa sustur
            const evt = new CustomEvent("netrex-tts-state", { detail: { active: false, text: "" } });
            window.dispatchEvent(evt);
          }
          toast.info(`Metin Okuma (TTS) ${newState ? 'açıldı' : 'kapatıldı'}.`);
        }
      });
    }

    return () => {
        clearTimeout(soundInitDelay);
        if (cleanupTriggered) cleanupTriggered();
        if (window.__netrexMobileCleanup) window.__netrexMobileCleanup();
    };
  }, []);

  // 📱 Mobil layout kullanılacak mı? (Electron'da asla, web'de sadece dar ekranda)
  const useMobileLayout = !isElectron && isMobile;

  // 🖥️ Üye listesi düğmeleri (sunucu başlığı, menü, kanal başlığı) yalnızca mobileMemberDrawerOpen'ı açıyor
  // ve bu bayrağı sadece mobil çekmece okuyor. Masaüstünde bu "aç isteği"ni sağ paneli açarak karşıla.
  useEffect(() => {
    if (!useMobileLayout && mobileMemberDrawerOpen) {
      setMobileMemberDrawerOpen(false);
      setShowMemberList(true);
    }
  }, [useMobileLayout, mobileMemberDrawerOpen, setMobileMemberDrawerOpen, setShowMemberList]);

  return (
    <div className={`
      app-shell
      h-screen w-screen
      flex flex-col
      bg-nds-bg-primary
      text-nds-text-primary
      overflow-hidden
      select-none
      ${useMobileLayout ? 'app-shell-mobile' : ''}
      ${className}
    `}>
      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Server Rail — masaüstüde göster, mobilde gizle */}
        {!useMobileLayout && serverRail}

        {/* Left Sidebar — masaüstüde göster, mobilde drawer */}
        {!useMobileLayout && (
          <AnimatePresence mode="wait">
            {sidebar && (
              <motion.aside
                key={sidebar.key || "sidebar"}
                initial={{ opacity: 0, x: -20, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 240 }}
                exit={{ opacity: 0, x: -20, width: 0 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className="
                  sidebar
                  h-full
                  bg-[#0a0a0c]
                  flex flex-col
                  flex-shrink-0
                  border-r border-nds-border-subtle
                  overflow-hidden
                "
              >
                <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0, transition: { duration: 0 } }}
                   transition={{ 
                     opacity: { delay: 0.35, duration: 0.2 },
                   }} 
                   className="w-sidebar h-full flex flex-col"
                >
                   {sidebar}
                </motion.div>
              </motion.aside>
            )}
          </AnimatePresence>
        )}

        {/* Main Content */}
        <main className="
          main-content
          flex-1
          h-full
          bg-nds-bg-tertiary
          overflow-hidden
          relative
          flex
        ">
          <div className="flex-1 flex flex-col h-full overflow-hidden">
             <ErrorBoundary>
               {children}
             </ErrorBoundary>
          </div>

          {/* Right Sidebar — masaüstüde göster, mobilde drawer */}
          {/* Panel (kapsayıcı) masaüstünde her zaman bağlı kalır: sunucu değişince ya da ana sayfaya dönünce içerik
              sol kenar çubuğu gibi animasyonla çıkıp girer (eskiden panel bir anda yok olup beliriyordu). */}
          {!useMobileLayout && (
            <div className="h-full flex-shrink-0 relative flex" style={{ zIndex: 'auto' }}>
              {hasRightSidebarContent && (
              <button
                onClick={onToggleRightSidebar}
                className={`
                  absolute top-1/2 -translate-y-1/2 -left-6 z-[70]
                  w-6 h-20
                  bg-gradient-to-l from-[#1a1b1e]/95 to-[#111214]/95
                  hover:from-indigo-600/20 hover:to-indigo-500/10
                  border-l border-t border-b border-white/10
                  rounded-l-xl
                  flex items-center justify-center
                  text-[#949ba4] hover:text-white
                  shadow-[-5px_0_20px_rgba(0,0,0,0.3)]
                  backdrop-blur-md
                  group
                  transition-colors duration-300
                `}
                title={showRightSidebar ? "Üye listesini gizle" : "Üye listesini göster"}
              >
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <ChevronRight 
                  className={`w-4 h-4 group-hover:scale-125 group-hover:text-indigo-400 transition-all duration-300 relative z-10 ${showRightSidebar ? '' : 'rotate-180'}`} 
                />
              </button>
              )}

              <motion.div
                initial={false}
                animate={{ width: panelOpen ? 240 : 0 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className="h-full overflow-hidden"
                // Panelin içi genişlik animasyonu sırasında dışarıyı etkilemesin / yeniden boyanmasın
                style={{ contain: "layout paint" }}
              >
                <AnimatePresence mode="wait">
                  {rightNode && (hasRightSidebarContent || closingForSwitch) && (
                    <motion.div
                      initial={false}
                      animate={{
                        opacity: panelOpen ? 1 : 0,
                        x: panelOpen ? 0 : 20
                      }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="
                        h-full w-[240px]
                        bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214]
                        border-l border-white/5
                        overflow-hidden
                      "
                    >
                      {rightNode}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}

        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════
         📱 MOBILE-ONLY: Bottom Nav + Drawers
         Electron'da ve geniş ekranlarda render edilmez.
         ════════════════════════════════════════════════════════════ */}
      {useMobileLayout && (
        <>
          {/* Bottom Navigation Bar */}
          <MobileNavBar
            friendsMode={friendsMode}
            hasCurrentServer={hasRightSidebarContent}
            onGoHome={onGoHome}
            onToggleFriendsMode={onToggleFriendsMode}
            onOpenServers={() => setMobileServerDrawer(true)}
            onOpenMembers={() => setMobileMemberDrawerOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            messengerBadge={messengerBadge}
          />

          {/* Server Selector Drawer */}
          <MobileDrawer
            isOpen={mobileServerDrawer}
            onClose={() => setMobileServerDrawer(false)}
            side="left"
            title="Sunucular"
          >
            <MobileServerSelector
              onSelectServer={(id) => {
                useServerStore.getState().selectServer(id);
                setMobileServerDrawer(false);
              }}
              onCreateServer={onOpenCreateModal}
              onClose={() => setMobileServerDrawer(false)}
            />
          </MobileDrawer>

          {/* Member List Drawer */}
          <MobileDrawer
            isOpen={mobileMemberDrawerOpen}
            onClose={() => setMobileMemberDrawerOpen(false)}
            side="right"
            title=""
            showCloseButton={false}
            width="85vw"
            maxWidth="320px"
          >
            {rightSidebar}
          </MobileDrawer>
        </>
      )}
      
      {/* Global Settings Modal - Accessible from anywhere in the app */}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal 
            isOpen={showSettingsModal} 
            onClose={() => setSettingsOpen(false)} 
          />
        </Suspense>
      )}
    </div>
  );
}
