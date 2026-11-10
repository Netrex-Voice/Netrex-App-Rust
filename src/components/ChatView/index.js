"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useOptionalRoomContext } from "@/src/hooks/useOptionalRoomContext";
import { RoomEvent } from "livekit-client";
import { useChatStore } from "@/src/store/chatStore";
import { useServerStore } from "@/src/store/serverStore";
import { Image as ImageIcon, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/src/utils/toast";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { MESSAGE_SEQUENCE_THRESHOLD } from "@/src/constants/appConfig";
import { uploadImageToCloudinary } from "@/src/utils/imageUpload";
import { popularEmojis } from "./constants";

// Sub-components
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import ImageOverlay from "./ImageOverlay";
import SecurityModal from "./SecurityModal";
import MessageContextMenu from "./MessageContextMenu";
// TTS utils are now handled by GlobalChatListener

export default function ChatView({ channelId, username, userId }) {
  const {
    messages,
    loadChannelMessages,
    loadOlderMessages,
    sendMessage,
    addIncomingMessage,
    deleteMessage,
    editMessage,
    deleteMessageSequence,
    currentChannel,
    hasMoreMessages,
    isLoading,
    isLoadingOlderMessages,
    typingUsers,
    sendTypingStatus,
    setTypingStatus,
    toggleReaction,
  } = useChatStore();
  const { currentServer, members } = useServerStore();
  const currentUser = useAuthStore((s) => s.user);
  // ✅ CPU OPT: O(n) find → O(1) Map lookup her mesaj render'ında
  const memberMap = useMemo(() => new Map((members || []).map(m => [m.id, m])), [members]);

  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [contextMenu, setContextMenu] = useState(null);
  const [linkModal, setLinkModal] = useState({ isOpen: false, url: "" });
  const [canUseNotifications, setCanUseNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Typing status management
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);


  // Editing State
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const inputRef = useRef(null);
  const room = useOptionalRoomContext();
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);

  // Gönderim hatasında geri yüklenen blob: URL'leri hiç revoke edilmiyordu
  useEffect(() => {
    if (typeof pendingImage === "string" && pendingImage.startsWith("blob:")) {
      return () => URL.revokeObjectURL(pendingImage);
    }
  }, [pendingImage]);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const virtuosoRef = useRef(null);

  // Otomatik scroll yönetimi (Atlama yapmayan temiz çözüm)
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        const anchor = document.getElementById('chat-bottom-anchor');
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
      }, 200); // Layout'un tam oturması için yeterli süre
      return () => clearTimeout(timer);
    }
  }, [messages.length]);
  
  // Image Viewer Manipulation States
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const [imgIsDragging, setImgIsDragging] = useState(false);
  const [imgPosition, setImgPosition] = useState({ x: 0, y: 0 });
  const [imgDragStart, setImgDragStart] = useState({ x: 0, y: 0 });

  // Drag & Drop State
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    // Yalnızca işletim sisteminden gelen dosya sürüklemelerini ele al; uygulama içi
    // sürüklemeler (kullanıcı/kanal taşıma) buradan geçmemeli.
    const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

    const handleDragEnter = (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); e.stopPropagation();
      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDraggingFile(true);
    };

    const handleDragLeave = (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDraggingFile(false); }
    };

    const handleDragOver = (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); e.stopPropagation();
    };

    const handleDrop = (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); e.stopPropagation();
      setIsDraggingFile(false); dragCounter.current = 0;
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => { setPendingImage(ev.target.result); setPendingImageFile(file); };
          reader.readAsDataURL(file);
        } else {
          toast.error("Sadece resim dosyaları yüklenebilir.");
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleImgZoomIn = useCallback(() => setImgZoom(prev => Math.min(prev + 0.25, 5)), []);
  const handleImgZoomOut = useCallback(() => setImgZoom(prev => Math.max(prev - 0.25, 0.5)), []);
  const handleImgRotate = useCallback(() => setImgRotation(prev => (prev + 90) % 360), []);
  const handleImgReset = useCallback(() => {
    setImgZoom(1); setImgRotation(0); setImgPosition({ x: 0, y: 0 });
  }, []);

  const imgRef = useRef(null);

  const lastPosRef = useRef(imgPosition);

  const handleImgMouseDown = (e) => {
    e.preventDefault();
    setImgIsDragging(true);
    setImgDragStart({ x: e.clientX - imgPosition.x, y: e.clientY - imgPosition.y });
  };

  const handleImgMouseMove = useCallback((e) => {
    if (imgIsDragging) {
      const newX = e.clientX - imgDragStart.x;
      const newY = e.clientY - imgDragStart.y;
      
      // Re-render tetiklemeden pozisyonu sakla
      lastPosRef.current = { x: newX, y: newY };
      
      if (imgRef.current) {
        imgRef.current.style.transform = `translate(${newX}px, ${newY}px) rotate(${imgRotation}deg) scale(${imgZoom})`;
      }
    }
  }, [imgIsDragging, imgDragStart, imgRotation, imgZoom]);

  const handleImgMouseUp = useCallback(() => {
    if (imgIsDragging) {
      setImgIsDragging(false);
      setImgPosition(lastPosRef.current);
    }
  }, [imgIsDragging]);

  // ✅ FIX: Keydown listener ref kullanıyor - state değişince listener kaldırılıp eklenmeyecek
  const selectedImageRef = useRef(selectedImage);
  const editingMessageIdRef = useRef(editingMessageId);
  useEffect(() => { selectedImageRef.current = selectedImage; }, [selectedImage]);
  useEffect(() => { editingMessageIdRef.current = editingMessageId; }, [editingMessageId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (selectedImageRef.current) setSelectedImage(null);
        if (editingMessageIdRef.current) handleCancelEdit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // ✅ Boş array - artık listener birikmiyor

  useEffect(() => { if (!selectedImage) handleImgReset(); }, [selectedImage, handleImgReset]);

  useEffect(() => {
    if (selectedImage) {
      const handleWheel = (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) setImgZoom(prev => Math.min(prev + 0.2, 5));
          else setImgZoom(prev => Math.max(prev - 0.2, 0.5));
        } else {
          setImgPosition(prev => {
            const newX = prev.x - e.deltaX; const newY = prev.y - e.deltaY;
            const limitX = window.innerWidth * 0.8; const limitY = window.innerHeight * 0.8;
            return { x: Math.max(Math.min(newX, limitX), -limitX), y: Math.max(Math.min(newY, limitY), -limitY) };
          });
        }
      };
      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => window.removeEventListener('wheel', handleWheel);
    }
  }, [selectedImage]);

  useEffect(() => { 
    if (channelId) {
      loadChannelMessages(channelId, currentServer?.id); 
    }
  }, [channelId, currentServer?.id, loadChannelMessages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "Notification" in window;
    setCanUseNotifications(supported);
    if (supported) setNotificationPermission(Notification.permission);
  }, []);

  const desktopNotifications = useSettingsStore(state => state.desktopNotifications);
  const notifyOnMessage = useSettingsStore(state => state.notifyOnMessage);


  const handleDataReceived = useCallback((payload, participant, kind, topic) => {
    if (topic !== "chat") return;
    try {
      const decoder = new TextDecoder();
      const data = JSON.parse(decoder.decode(payload));
      if (data.type === "chat" && data.channelId === channelId) {
        if (data.message.userId !== userId) {
          addIncomingMessage(data.message);
        }
        // TTS artık GlobalChatListener tarafından yönetiliyor (tüm kanallar için)
      }
    } catch (error) {}
  }, [channelId, userId, addIncomingMessage]);

  useEffect(() => {
    if (!room) return;
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => room.off(RoomEvent.DataReceived, handleDataReceived);
  }, [room, handleDataReceived]);

  useEffect(() => {
    const handleClick = (e) => {
      setContextMenu(null);
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target) && !e.target.closest('[data-emoji-button]')) {
        setShowEmojiPicker(false);
      }
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, [channelId]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!messageInput.trim() && !pendingImageFile) || isSending || cooldownRemaining > 0) return;

    const textToSend = messageInput;
    const fileToSend = pendingImageFile;

    setMessageInput(""); setPendingImage(null); setPendingImageFile(null); setIsSending(true);

    try {
      let imageUrl = null;
      if (fileToSend) {
          const toastId = toast.loading("Resim yükleniyor...");
          try {
             imageUrl = await uploadImageToCloudinary(fileToSend);
             toast.success("Resim yüklendi.", { id: toastId });
          } catch(err) {
             toast.error("Resim yüklenemedi: " + err.message, { id: toastId });
             setIsSending(false);
             setPendingImage(URL.createObjectURL(fileToSend));
             setPendingImageFile(fileToSend);
             setMessageInput(textToSend);
             return;
          }
      }

      // Kullanıcı metadata'sını hazırla (avatar + profil rengi için)
      const member = members?.find((m) => m.id === userId);
      const displayName =
        member?.displayName ||
        currentUser?.displayName ||
        username ||
        "Kullanıcı";
      const photoURL =
        currentUser?.photoURL ||
        member?.photoURL ||
        null;
      const profileColor = member?.profileColor || null;

      const userMeta = {
        id: userId,
        displayName,
        photoURL,
        profileColor,
      };

      const result = await sendMessage(
        channelId,
        textToSend,
        userId,
        displayName,
        room,
        currentChannel?.serverId,
        {
          type: imageUrl ? "image" : "text",
          imageUrl,
          user: userMeta,
          profileColor,
          avatarUrl: photoURL,
        }
      );
      if (!result?.success) {
        setMessageInput(textToSend);
        if (fileToSend) { setPendingImage(URL.createObjectURL(fileToSend)); setPendingImageFile(fileToSend); }
        if (result?.cooldownRemaining) setCooldownRemaining(result.cooldownRemaining);
        else toast.error(result?.error || "Mesaj gönderilemedi.");
      } else {
        // TTS artık GlobalChatListener tarafından yönetiliyor
      }
    } catch (error) {
      toast.error("Mesaj gönderilemedi.");
    } finally {
      setIsSending(false);
      setTimeout(() => { inputRef.current?.focus(); }, 10);
    }
  };

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const handleMessageInputChange = (e) => {
    const value = e.target.value;
    setMessageInput(value);
    if (!room || !channelId) return;
    if (!isTypingRef.current && value.trim().length > 0) {
      isTypingRef.current = true;
      sendTypingStatus(channelId, userId, username, true, room);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingStatus(channelId, userId, username, false, room);
    }, 3000);
  };

  const handleEnableNotifications = useCallback(async () => {
    if (!canUseNotifications) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") toast.success("Bildirimler etkinleştirildi.");
    } catch (error) { toast.error("Bildirim izni alınamadı."); }
  }, [canUseNotifications]);

  const handleLoadOlderMessages = useCallback(async () => {
    if (!currentChannel) return;
    await loadOlderMessages(currentChannel.id);
  }, [currentChannel, loadOlderMessages]);

  const handleContextMenu = useCallback((e, msg, isInSequence) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message: msg, isInSequence: isInSequence || false });
  }, []);

  const handleCopyText = () => {
    if (contextMenu?.message?.text) {
      navigator.clipboard.writeText(contextMenu.message.text);
      toast.success("Metin panoya kopyalandı.");
    }
    setContextMenu(null);
  };

  const handleCopyImageLink = () => {
    if (contextMenu?.message?.imageUrl) {
      navigator.clipboard.writeText(contextMenu.message.imageUrl);
      toast.success("Resim linki kopyalandı.");
    }
    setContextMenu(null);
  };

  const handleCopyImage = async () => {
    if (contextMenu?.message?.imageUrl) {
      const toastId = toast.loading("Resim hazırlanıyor...");
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = contextMenu.message.imageUrl; });
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
          if (!blob) return toast.error("Resim oluşturulamadı.", { id: toastId });
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast.success("Resim kopyalandı.", { id: toastId });
          } catch (err) { toast.error("Panoya yazılamadı.", { id: toastId }); }
        }, 'image/png');
      } catch (error) { toast.error("Resim kopyalanamadı.", { id: toastId }); }
    }
    setContextMenu(null);
  };

  const handleDeleteMsg = async () => {
    if (contextMenu?.message) { await deleteMessage(channelId, contextMenu.message.id); toast.success("Mesaj silindi."); }
    setContextMenu(null);
  };

  const handleDeleteSequence = async () => {
    if (!contextMenu?.message) return;
    const result = await deleteMessageSequence(channelId, contextMenu.message.id);
    if (result.success) toast.success(`${result.deletedCount} mesaj silindi.`);
    else toast.error(result.error || "Mesajlar silinemedi.");
    setContextMenu(null);
  };
 
  const handleStartEdit = (message) => {
    setEditingMessageId(message.id); setEditingText(message.text); setContextMenu(null);
  };
 
  const handleSaveEdit = async () => {
    if (!editingMessageId) return;
    const result = await editMessage(channelId, editingMessageId, editingText, userId);
    if (result.success) { setEditingMessageId(null); setEditingText(""); }
    else toast.error(result.error);
  };
 
  const handleCancelEdit = () => { setEditingMessageId(null); setEditingText(""); };

  const handleToggleReaction = useCallback(async (messageId, emoji) => {
    await toggleReaction(channelId, messageId, emoji, userId);
  }, [channelId, toggleReaction, userId]);
 
  const getMessageTs = (ts) => ts?.toMillis?.() ?? (typeof ts === "number" ? ts : (ts ? new Date(ts).getTime() : NaN));

  // Görsel birleştirme: bu mesaj, öncekinin devamı mı? (SADECE geriye bakar)
  // Önceden sonraki mesaj da kontrol edildiği için, bir grubun ilk mesajı da "devam" sayılıp
  // avatar/isim başlığı gizleniyor ve önceki kullanıcının mesajı gibi görünüyordu.
  const isMessageContinuation = useCallback((message, index) => {
    if (index === 0) return false;
    const prevMessage = messages[index - 1];
    if (!prevMessage || prevMessage.userId !== message.userId) return false;
    const diff = getMessageTs(message.timestamp) - getMessageTs(prevMessage.timestamp);
    return diff >= 0 && diff < MESSAGE_SEQUENCE_THRESHOLD;
  }, [messages]);

  // Sağ tık menüsündeki "diziyi sil" için: mesaj bir grubun parçası mı? (önceki VEYA sonraki)
  const isMessageInSequence = useCallback((message, index) => {
    if (isMessageContinuation(message, index)) return true;
    const nextMessage = messages[index + 1];
    return !!nextMessage && isMessageContinuation(nextMessage, index + 1);
  }, [messages, isMessageContinuation]);

  const openLinkModal = useCallback((e, url) => { e.preventDefault(); setLinkModal({ isOpen: true, url }); }, []);
  const confirmOpenLink = useCallback(() => {
    if (linkModal.url) {
      if (window.netrex && window.netrex.openExternalLink) window.netrex.openExternalLink(linkModal.url);
      else window.open(linkModal.url, "_blank");
    }
    setLinkModal({ isOpen: false, url: "" });
  }, [linkModal.url]);

  const handleEmojiClick = useCallback((emoji, e) => {
    e?.stopPropagation();
    const input = inputRef.current; if (!input) return;
    const start = input.selectionStart || 0; const end = input.selectionEnd || 0;
    const newValue = messageInput.substring(0, start) + emoji + messageInput.substring(end);
    setMessageInput(newValue);
    setTimeout(() => { input.focus(); const newCursorPos = start + emoji.length; input.setSelectionRange(newCursorPos, newCursorPos); }, 10);
  }, [messageInput]);

  const renderMessageText = useCallback((text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        const fullUrl = part;
        const displayText = fullUrl.length > 50 ? fullUrl.substring(0, 50) + "..." : fullUrl;
        return <a key={index} href={fullUrl} onClick={(e) => openLinkModal(e, fullUrl)} className="text-[#00a8fc] hover:underline cursor-pointer break-all font-medium" title={fullUrl}>{displayText}</a>;
      }
      return <span key={index}>{part}</span>;
    });
  }, [openLinkModal]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Lütfen geçerli bir resim dosyası seçin.");
    const reader = new FileReader(); reader.onload = (ev) => { setPendingImage(ev.target.result); setPendingImageFile(file); };
    reader.readAsDataURL(file); if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items; if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader(); reader.onload = (ev) => { setPendingImage(ev.target.result); setPendingImageFile(file); };
          reader.readAsDataURL(file); e.preventDefault(); 
        }
      }
    }
  }, []);

  const removePendingImage = useCallback(() => {
    setPendingImage(null); setPendingImageFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }, []);

  const formatDateHeader = useCallback((timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  }, []);

  const shouldShowNotificationBanner = canUseNotifications && notificationPermission !== "granted";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12] h-full w-full relative overflow-hidden"
    >
      <div className="flex flex-col h-full w-full relative z-10">
        {/* DRAG OVERLAY */}
        {isDraggingFile && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md border-4 border-indigo-500/50 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
             <div className="flex flex-col items-center gap-6 p-10 bg-[#0f0f12]/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/10 transform scale-105">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 animate-bounce shadow-lg shadow-indigo-500/20">
                  <ImageIcon size={48} className="text-indigo-400" />
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-white mb-2 tracking-tight">Resmi Bırak</h3>
                  <p className="text-white/60 text-lg font-medium">Yüklemek için herhangi bir yere bırakın</p>
                </div>
             </div>
          </div>,
          document.body
        )}


        
        {shouldShowNotificationBanner && (
          <div className="px-4 pt-4 relative z-10">
            <div className="flex items-center justify-between bg-gradient-to-br from-indigo-500/10 to-purple-500/5 backdrop-blur-sm border border-indigo-500/20 rounded-2xl px-4 py-3 text-sm text-white/90 gap-3 shadow-[0_4px_20px_rgba(99,102,241,0.15)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                  <Bell size={16} className="text-indigo-400" />
                </div>
                <span className="font-medium">Yeni mesajlarda masaüstü bildirimi almak için izni etkinleştirin.</span>
              </div>
              <button
                onClick={handleEnableNotifications}
                className="px-4 py-2 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
              >
                Bildirimleri Aç
              </button>
            </div>
          </div>
        )}

        {/* Mesaj Alanı */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative z-10 w-full">
          <div className="flex-1 overflow-hidden relative h-full w-full flex flex-col">
            <MessageList 
              messages={messages}
              virtuosoRef={virtuosoRef}
              isLoading={isLoading}
              currentChannel={currentChannel}
              handleLoadOlderMessages={handleLoadOlderMessages}
              hasMoreMessages={hasMoreMessages}
              isLoadingOlderMessages={isLoadingOlderMessages}
              typingUsers={typingUsers}
              channelId={channelId}
              userId={userId}
              members={members}
              memberMap={memberMap}
              editingMessageId={editingMessageId}
              editingText={editingText}
              setEditingText={setEditingText}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
              handleToggleReaction={handleToggleReaction}
              handleContextMenu={handleContextMenu}
              renderMessageText={renderMessageText}
              formatTime={formatTime}
              formatDateHeader={formatDateHeader}
              isMessageInSequence={isMessageInSequence}
              isMessageContinuation={isMessageContinuation}
              setSelectedImage={setSelectedImage}
            />
          </div>
        </div>

        <ChatInput 
          messageInput={messageInput}
          setMessageInput={setMessageInput}
          handleSendMessage={handleSendMessage}
          isSending={isSending}
          cooldownRemaining={cooldownRemaining}
          pendingImage={pendingImage}
          pendingImageFile={pendingImageFile}
          removePendingImage={removePendingImage}
          inputRef={inputRef}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          emojiPickerRef={emojiPickerRef}
          popularEmojis={popularEmojis}
          handleEmojiClick={handleEmojiClick}
          handleImageSelect={handleImageSelect}
          fileInputRef={fileInputRef}
          handleMessageInputChange={handleMessageInputChange}
          handlePaste={handlePaste}
        />
      </div>

      <ImageOverlay 
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
        imgZoom={imgZoom}
        imgRotation={imgRotation}
        imgPosition={imgPosition}
        imgIsDragging={imgIsDragging}
        imgRef={imgRef}
        handleImgMouseDown={handleImgMouseDown}
        handleImgMouseMove={handleImgMouseMove}
        handleImgMouseUp={handleImgMouseUp}
        handleImgZoomIn={handleImgZoomIn}
        handleImgZoomOut={handleImgZoomOut}
        handleImgRotate={handleImgRotate}
        handleImgReset={handleImgReset}
      />

      <SecurityModal 
        isOpen={linkModal.isOpen}
        url={linkModal.url}
        onClose={() => setLinkModal({ isOpen: false, url: "" })}
        onConfirm={confirmOpenLink}
      />

      <MessageContextMenu 
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        userId={userId}
        handleToggleReaction={handleToggleReaction}
        handleCopyText={handleCopyText}
        handleCopyImage={handleCopyImage}
        handleCopyImageLink={handleCopyImageLink}
        handleStartEdit={handleStartEdit}
        handleDeleteMsg={handleDeleteMsg}
        handleDeleteSequence={handleDeleteSequence}
      />
    </motion.div>
  );
}
