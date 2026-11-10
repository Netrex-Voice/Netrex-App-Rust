
import { useEffect, useRef, useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useChatStore } from "@/src/store/chatStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { chatToast } from "@/src/utils/toast";
import { applyVoiceCustomization, sanitizeForTTS } from "@/src/components/ChatView/utils";
import { useServerStore } from "@/src/store/serverStore";

// --- GLOBAL CHAT & EVENTS ---
export default function GlobalChatListener({ showChatPanel, setShowChatPanel }) {
  const room = useRoomContext();
  const { user } = useAuthStore();
  const { playSound } = useSoundEffects();

  // ✅ Stale closure önleme: Props ve state'leri ref'lerde tut
  // Bu sayede event handler her zaman güncel değerlere erişir
  const showChatPanelRef = useRef(showChatPanel);
  const setShowChatPanelRef = useRef(setShowChatPanel);
  
  useEffect(() => { showChatPanelRef.current = showChatPanel; }, [showChatPanel]);
  useEffect(() => { setShowChatPanelRef.current = setShowChatPanel; }, [setShowChatPanel]);
  
  // ✅ FIX: useRef guard to prevent duplicate event listener registration
  const hasRegisteredChatRef = useRef(false);
  
  // TTS State Management (global - works even when chat panel is closed)
  const lastTtsSpeakerRef = useRef(null);
  const lastTtsTimeRef = useRef(0);

  // Linki harici tarayıcıda açma yardımcısı
  const openLinkExternal = useCallback((url) => {
    if (window.netrex?.openExternalLink) {
      window.netrex.openExternalLink(url);
    } else {
      window.open(url, "_blank");
    }
  }, []);

  // Uygulamayı ön plana getirme yardımcısı
  const bringAppToFront = useCallback(() => {
    if (window.netrex?.focusWindow) {
      window.netrex.focusWindow();
    } else {
      window.focus();
    }
  }, []);

  // Kanala git yardımcısı - güncel store state'ini kullanır
  const navigateToChannel = useCallback((channelId) => {
    // 1. Chat panelini aç
    if (setShowChatPanelRef.current) {
      setShowChatPanelRef.current(true);
    }
    
    // 2. Güncel store state'i üzerinden kanal geçişi yap
    const chatState = useChatStore.getState();
    const serverState = useServerStore.getState();
    
    if (channelId && channelId !== chatState.currentChannel?.id) {
      // Server ID'yi bul - eğer server kanal yapısı kullanılıyorsa
      const serverId = serverState.currentServer?.id || null;
      chatState.loadChannelMessages(channelId, serverId);
    }
  }, []);
  
  useEffect(() => {
    if (!room) return;
    
    // ✅ CRITICAL FIX: Only register events ONCE per room instance
    if (hasRegisteredChatRef.current) {
      return;
    }
    
    hasRegisteredChatRef.current = true;
    console.log("✅ Registering chat event listener (ONCE)");
    
    const handleData = (payload, participant, kind, topic) => {
      if (topic !== "chat" && topic !== "typing") return;
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        
        // Güncel user ID'yi al (stale closure önleme)
        const currentUserId = useAuthStore.getState().user?.uid;
        
        if (data.type === "chat" && data.message.userId !== currentUserId) {
          const message = data.message;
          const channelId = data.channelId;
          
          // Güncel state'leri al (stale closure önleme)
          const chatState = useChatStore.getState();
          const settingsState = useSettingsStore.getState();
          const isShowingChat = showChatPanelRef.current;
          
          // Mesajın geldiği kanalın adını bul
          const messageChannel = chatState.textChannels.find((ch) => ch.id === channelId);
          const channelName = messageChannel?.name || "sohbet";

          // Toast bildirim göster (uygulama içindeyse VE sohbet paneli kapalıysa)
          if (
            typeof document !== "undefined" &&
            !document.hidden &&
            document.hasFocus() &&
            !isShowingChat
          ) {
            chatToast({
              username: message.username || "Bir kullanıcı",
              message: message.text,
              channelName: channelName,
              avatarColor: message.profileColor,
              onClick: () => {
                // Eğer mesaj link içeriyorsa → harici tarayıcıda aç
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const urls = message.text ? message.text.match(urlRegex) : null;
                if (urls && urls.length > 0) {
                  openLinkExternal(urls[0]);
                }
                // Kanala git
                navigateToChannel(channelId);
              },
            });
          }

          // Masaüstü bildirim göster (ayarlardan açtıysa)
          if (settingsState.desktopNotifications && settingsState.notifyOnMessage) {
            if (typeof window !== "undefined" && "Notification" in window) {
              if (Notification.permission === "granted") {
                const isAppInBackground =
                  typeof document !== "undefined" &&
                  (document.hidden || !document.hasFocus());
                const shouldNotify = isAppInBackground || !isShowingChat;

                if (shouldNotify) {
                  const body = message.text
                    ? message.text.length > 120
                      ? message.text.slice(0, 120) + "..."
                      : message.text
                    : "Yeni mesaj";

                  try {
                    const notification = new Notification(
                      `${message.username || "Bir kullanıcı"} - #${channelName}`,
                      {
                        body: body,
                        icon: "/favicon.ico",
                        badge: "/favicon.ico",
                        tag: `message-${channelId}-${Date.now()}`,
                        silent: false,
                      }
                    );

                    notification.onclick = () => {
                      // 1. Uygulamayı ön plana getir
                      bringAppToFront();

                      // 2. Link varsa harici tarayıcıda aç
                      const urlRegex = /(https?:\/\/[^\s]+)/g;
                      const urls = message.text ? message.text.match(urlRegex) : null;
                      if (urls && urls.length > 0) {
                        openLinkExternal(urls[0]);
                      }

                      // 3. Bildirim kanalına git ve chat panelini aç
                      navigateToChannel(channelId);
                      
                      notification.close();
                    };

                    // 5 saniye sonra otomatik kapat
                    setTimeout(() => notification.close(), 5000);
                  } catch (error) {
                    console.error("Masaüstü bildirim hatası:", error);
                  }
                }
              }
            }
          }

          // 🔊 TTS: Chat paneli açık olmasa bile bildirimleri oku
          if (settingsState.ttsEnabled && 'speechSynthesis' in window) {
            const isMutedChannel = settingsState.mutedTtsChannels.includes(channelId);
            const isMutedUser = settingsState.mutedTtsUsers.includes(message.userId);
            const shouldSkipFocus = settingsState.ttsOnlyUnfocused && document.hasFocus();

            if (!isMutedChannel && !isMutedUser && !shouldSkipFocus) {
              let textToRead = "";
              const senderName = message.username || "Bir kullanıcı";
              const senderId = message.userId;
              const now = Date.now();

              const isSameSpeaker = lastTtsSpeakerRef.current === senderId && (now - lastTtsTimeRef.current < 120000);
              
              if (message.type === 'image' || message.imageUrl) {
                textToRead = isSameSpeaker ? "Bir resim paylaştı." : `${senderName} bir resim paylaştı.`;
              } else if (message.text) {
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                let rawText = message.text;
                if (urlRegex.test(rawText)) {
                  rawText = rawText.replace(urlRegex, 'bir bağlantı gönderdi.');
                }
                
                const { text: cleanText, isSpam } = sanitizeForTTS(rawText);
                
                if (isSpam) {
                  textToRead = isSameSpeaker ? cleanText : `${senderName} ${cleanText}`;
                } else if (cleanText) {
                  textToRead = isSameSpeaker ? cleanText : `${senderName}: ${cleanText}`;
                }
              }

              if (textToRead) {
                lastTtsSpeakerRef.current = senderId;
                lastTtsTimeRef.current = now;
                
                // ✅ Kuyruk yönetimi: Max 3 bekleyen mesaj - fazlasını at
                const pending = window.speechSynthesis.pending;
                if (pending && window.__netrexTtsQueueCount >= 3) {
                  console.log("[TTS] Queue full, skipping:", textToRead.substring(0, 30));
                } else {
                  const utterance = new SpeechSynthesisUtterance(textToRead);
                  utterance.lang = 'tr-TR';
                  utterance.volume = settingsState.ttsVolume / 100;
                  applyVoiceCustomization(utterance, message.userId, settingsState.ttsVoiceURI);
                  
                  // ✅ Queue sayacı
                  window.__netrexTtsQueueCount = (window.__netrexTtsQueueCount || 0) + 1;
                  
                  // ✅ TTS durumunu global state'e yaz (UI stop butonu için)
                  // Speeche giden metin (textToRead) ile UI'da gözüken (displayText) farklı olabilir
                  const displayText = `${senderName}: ${message.text || ""}`;
                  window.__netrexTtsActive = true;
                  window.dispatchEvent(new CustomEvent('netrex-tts-state', { 
                    detail: { active: true, text: displayText } 
                  }));
                  
                  utterance.onend = () => {
                    window.__netrexTtsQueueCount = Math.max(0, (window.__netrexTtsQueueCount || 1) - 1);
                    if (window.__netrexTtsQueueCount === 0 && !window.speechSynthesis.speaking) {
                      window.__netrexTtsActive = false;
                      window.dispatchEvent(new CustomEvent('netrex-tts-state', { detail: { active: false } }));
                    }
                  };
                  utterance.onerror = utterance.onend;
                  
                  window.speechSynthesis.speak(utterance);
                }
              }
            }
          }

          // Okunmamış sayacı ve ses
          if (
            !chatState.currentChannel ||
            chatState.currentChannel.id !== channelId ||
            !isShowingChat
          ) {
            chatState.incrementUnread(channelId);
            playSound("message");
          }
        } else if (data.type === "typing") {
          const chatState = useChatStore.getState();
          chatState.setTypingStatus(data.channelId, data.userId, data.username, data.isTyping);
        }
      } catch (e) {
        console.error(e);
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      console.log("🧹 Cleaning up chat event listener");
      hasRegisteredChatRef.current = false;
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]); // ✅ Minimal dependencies - tüm güncel state ref/getState üzerinden alınıyor
  return null;
}
