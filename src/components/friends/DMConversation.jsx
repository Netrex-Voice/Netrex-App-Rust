"use client";

/**
 * 💬 DMConversation - Professional DM Chat View
 * Modern, Discord-like direct messaging interface
 * Integrated with the main Chat architecture for features like:
 * - Real-time messaging & Presence
 * - Message Editing & Deleting
 * - Reactions & Emoji Picker
 * - Image Uploads & Drag-and-Drop
 * - Voice Calling (already integrated)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Send, ArrowLeft, Phone, MoreVertical, 
  Loader2, Plus, Image as ImageIcon, Smile,
  X, UserMinus, ShieldAlert, MessageCircle, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDMStore } from "@/src/store/dmStore";
import { useAuthStore } from "@/src/store/authStore";
import { useFriendStore } from "@/src/store/friendStore";
import { useServerStore } from "@/src/store/serverStore";
import { useOptionalRoomContext } from "@/src/hooks/useOptionalRoomContext";
import { toast } from "@/src/utils/toast";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import Avatar from "@/src/components/ui/Avatar";
import { uploadImageToCloudinary } from "@/src/utils/imageUpload";
import { MESSAGE_SEQUENCE_THRESHOLD } from "@/src/constants/appConfig";

// Reusing optimized Chat sub-components
import MessageList from "@/src/components/ChatView/MessageList";
import ChatInput from "@/src/components/ChatView/ChatInput";
import ImageOverlay from "@/src/components/ChatView/ImageOverlay";
import SecurityModal from "@/src/components/ChatView/SecurityModal";
import MessageContextMenu from "@/src/components/ChatView/MessageContextMenu";
import { popularEmojis } from "@/src/components/ChatView/constants";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";

// Durum noktası ve etiketi: "boşta" ve "rahatsız etme" da çevrimiçi sayılır (eskiden hepsi "çevrimdışı" görünüyordu)
const PRESENCE_DOT = { online: "bg-green-500", idle: "bg-yellow-500", dnd: "bg-red-500" };
const PRESENCE_LABEL = { online: "Çevrimiçi", idle: "Boşta", dnd: "Rahatsız Etme" };

export default function DMConversation({ onBack, onStartCall }) {
  const { user } = useAuthStore();
  const {
    activeConversation,
    messages,
    isLoading,
    isLoadingOlder,
    hasMoreMessages,
    sendMessage,
    loadOlderMessages,
    deleteMessage,
    editMessage,
    deleteMessageSequence,
    toggleReaction,
    users: realTimeUsers,
    typingUsers,
    sendTypingStatus,
    clearActiveConversation
  } = useDMStore();

  const { removeFriend, blockUserById, unblockUser, friends, blockedUsers } = useFriendStore();
  const { members } = useServerStore();
  const room = useOptionalRoomContext();

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  
  // UI States (Consistent with ChatView)
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [linkModal, setLinkModal] = useState({ isOpen: false, url: "" });
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [removeFriendConfirm, setRemoveFriendConfirm] = useState(false);
  const headerMenuRef = useRef(null);
  
  // Audio manipulation states for ImageOverlay
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const [imgPosition, setImgPosition] = useState({ x: 0, y: 0 });
  const [imgIsDragging, setImgIsDragging] = useState(false);

  const dragCounter = useRef(0);
  const inputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const virtuosoRef = useRef(null);
  const imgRef = useRef(null);

  const otherId = activeConversation?.participantIds?.find(id => id !== user?.uid);
  const otherUser = realTimeUsers[otherId] || activeConversation?.otherUser;
  const presence = getEffectivePresence(otherUser);
  const blockState = otherId ? blockedUsers?.[otherId] : null; // "byMe" | "byThem" | undefined

  // Initial focus
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversation?.id]);

  // Mark as read when active or new messages arrive
  useEffect(() => {
    if (activeConversation?.id && user?.uid) {
      useDMStore.getState().markDMAsRead(activeConversation.id, user.uid);
    }
  }, [activeConversation?.id, messages.length, user?.uid]);

  // Click outside to close menus
  useEffect(() => {
    const handleClick = (e) => {
      setContextMenu(null);
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setShowHeaderMenu(false);
      }
      setShowEmojiPicker(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDraggingFile(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) setIsDraggingFile(false);
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

    const handleDrop = (e) => {
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

  const mappedMessages = useMemo(() => {
    return messages.map(m => ({ 
      ...m, 
      userId: m.senderId,
      username: m.senderName, // Map senderName to username for MessageItem compatibility
    }));
  }, [messages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if ((!text && !pendingImageFile) || isSending) return;

    if (blockState) {
      toast.error(blockState === "byMe" ? "Bu kullanıcıyı engelledin. Mesaj göndermek için önce engeli kaldır." : "Bu kullanıcıya mesaj gönderemezsin.");
      return;
    }

    const textToSend = text;
    const fileToSend = pendingImageFile;
    const previewToRestore = pendingImage;

    setInputText(""); 
    setPendingImage(null); 
    setPendingImageFile(null); 
    setIsSending(true);

    try {
      let imageUrl = null;
      if (fileToSend) {
        const toastId = toast.loading("Resim yükleniyor...");
        try {
          imageUrl = await uploadImageToCloudinary(fileToSend);
          toast.success("Resim yüklendi.", { id: toastId });
        } catch (err) {
          toast.error("Resim yüklenemedi.", { id: toastId });
          setIsSending(false);
          setInputText(textToSend);
          setPendingImage(previewToRestore); // önizleme de geri gelsin (eskiden yalnızca dosya geri geliyordu)
          setPendingImageFile(fileToSend);
          return;
        }
      }

      const result = await sendMessage(
        activeConversation.id,
        textToSend,
        user.uid,
        user.displayName || "Kullanıcı",
        {
          type: imageUrl ? "image" : "text",
          imageUrl,
          avatarUrl: user.photoURL,
        }
      );

      if (!result.success) {
        setInputText(textToSend);
        toast.error(result.error || "Mesaj gönderilemedi.");
      }
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleStartCallExec = async () => {
    if (!activeConversation || isCalling) return;
    setIsCalling(true);
    try {
      await onStartCall?.(activeConversation.id);
    } finally {
      setTimeout(() => setIsCalling(false), 1500);
    }
  };

  // Helper functions (Consistent with ChatView index)
  const handleStartEdit = (message) => {
    setEditingMessageId(message.id);
    setEditingText(message.text);
    setContextMenu(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId) return;
    if (!editingText.trim()) {
      toast.error("Mesaj boş olamaz.");
      return;
    }
    const result = await editMessage(activeConversation.id, editingMessageId, editingText, user.uid);
    if (result.success) {
      setEditingMessageId(null);
      setEditingText("");
    } else {
      toast.error(result.error || "Mesaj düzenlenemedi.");
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleContextMenu = useCallback((e, msg, isInSequence) => {
    e.preventDefault();
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      message: msg, 
      isInSequence: isInSequence || false 
    });
  }, []);

  const handleToggleReactionLocal = useCallback(async (messageId, emoji) => {
    await toggleReaction(activeConversation.id, messageId, emoji, user.uid);
  }, [activeConversation?.id, toggleReaction, user?.uid]);

  const handleDeleteMsg = async () => {
    if (contextMenu?.message) {
      await deleteMessage(activeConversation.id, contextMenu.message.id);
      toast.success("Mesaj silindi.");
    }
    setContextMenu(null);
  };

  const handleClearChat = async () => {
    if (!activeConversation?.id) return;
    try {
      const { clearConversation } = useDMStore.getState();
      const result = await clearConversation(activeConversation.id);
      if (result.success) {
        toast.success("Sohbet temizlendi.");
      } else {
        toast.error("Temizleme hatası.");
      }
    } catch (error) {
      toast.error("Hata oluştu.");
    } finally {
      setClearConfirm(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Lüfen resim seçin.");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingImage(ev.target.result);
      setPendingImageFile(file);
    };
    reader.readAsDataURL(file);
  };

  const isMessageInSequence = useCallback((message, index) => {
    if (index === 0) return false;
    const prevMessage = mappedMessages[index - 1];
    if (!prevMessage) return false;

    const getTs = (ts) => ts?.toMillis?.() || (typeof ts === 'number' ? ts : (ts ? new Date(ts).getTime() : Date.now()));

    const currentTs = getTs(message.timestamp);
    const prevTs = getTs(prevMessage.timestamp);

    // Only look backwards: Is this message a continuation of the previous one?
    return prevMessage.userId === message.userId && 
           currentTs - prevTs >= 0 && 
           currentTs - prevTs < MESSAGE_SEQUENCE_THRESHOLD;
  }, [mappedMessages]);

  const formatTime = (ts) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateHeader = (ts) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  };

  const renderMessageText = (text) => {
     if (!text) return null;
     const urlRegex = /(https?:\/\/[^\s]+)/g;
     const parts = text.split(urlRegex);
     return parts.map((part, index) => {
       if (part.match(urlRegex)) {
         return (
           <a
             key={index}
             href={part}
             rel="noopener noreferrer"
             onClick={(e) => { e.preventDefault(); setLinkModal({ isOpen: true, url: part }); }}
             className="text-indigo-400 hover:underline"
           >
             {part}
           </a>
         );
       }
       return <span key={index}>{part}</span>;
     });
  };

  // Create virtual members for MessageList/MessageItem compatibility
  const dmMembers = useMemo(() => {
    const list = [];
    if (user) {
      list.push({
        id: user.uid,
        displayName: user.displayName || "Sen",
        photoURL: user.photoURL,
        profileColor: null
      });
    }
    if (otherUser) {
      list.push({
        id: otherId,
        displayName: otherUser.displayName,
        photoURL: otherUser.photoURL,
        profileColor: otherUser.profileColor || null
      });
    }
    return list;
  }, [user, otherUser, otherId]);

  const dmMemberMap = useMemo(() => new Map(dmMembers.map(m => [m.id, m])), [dmMembers]);

  if (!activeConversation || !otherUser) return null;

  return (
    <div className="h-full flex flex-col bg-[#111214] relative overflow-hidden">
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

      {/* ── Header ── */}
      <div className="h-[48px] px-4 flex items-center justify-between border-b border-white/[0.06] bg-[#111214]/50 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 text-[#949ba4] hover:text-white lg:hidden">
            <ArrowLeft size={20} />
          </button>
          
          <div className="relative">
             <Avatar
               uid={otherUser.uid || otherUser.id}
               src={otherUser.photoURL}
               name={otherUser.displayName}
               color={otherUser.profileColor}
               size="md"
               status={presence}
             />
          </div>

          <div>
             <h3 className="text-[15px] font-bold text-white leading-tight">{otherUser.displayName}</h3>
             <p className="text-[11px] text-[#949ba4] leading-tight">
               {PRESENCE_LABEL[presence] || 'Çevrimdışı'}
             </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <button 
            onClick={handleStartCallExec}
            disabled={isCalling}
            className={`p-2 rounded-md transition-colors ${isCalling ? 'bg-white/5 text-indigo-400' : 'text-[#949ba4] hover:text-green-400 hover:bg-white/5'}`}
            title="Sesli Arama Başlat"
          >
            {isCalling ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
          </button>
          
          <div ref={headerMenuRef} className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(!showHeaderMenu); }}
              className={`p-2 rounded-md transition-colors ${showHeaderMenu ? 'bg-white/10 text-white' : 'text-[#949ba4] hover:text-white hover:bg-white/5'}`}
            >
              <MoreVertical size={18} />
            </button>

            {showHeaderMenu && (
              <div className="
                absolute right-0 top-full mt-1 w-48
                bg-[#111214] border border-white/5 shadow-2xl rounded-xl
                py-1.5 z-[100] animate-in fade-in zoom-in duration-150
              ">
                <button
                  onClick={() => {
                    clearActiveConversation();
                    setShowHeaderMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#dbdee1] hover:bg-white/5 hover:text-white transition-colors"
                >
                  <X size={14} className="text-[#949ba4]" />
                  Mesajlaşmayı Kapat
                </button>
                {blockState === "byMe" ? (
                  <button
                    onClick={async () => {
                      setShowHeaderMenu(false);
                      await unblockUser(user.uid, otherId);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <ShieldAlert size={14} />
                    Engeli Kaldır
                  </button>
                ) : blockState === "byThem" ? null : (
                  <button
                    onClick={() => {
                      setBlockConfirm(true);
                      setShowHeaderMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <ShieldAlert size={14} />
                    Kullanıcıyı Engelle
                  </button>
                )}
                
                {(() => {
                  const activeFriendship = (friends || []).find(f => f.friendId === otherId);
                  if (activeFriendship) {
                    return (
                      <button
                        onClick={() => {
                          setRemoveFriendConfirm(true);
                          setShowHeaderMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <UserMinus size={14} />
                        Arkadaşı Kaldır
                      </button>
                    );
                  }
                  return null;
                })()}
                <div className="h-px bg-white/5 my-1 mx-2" />
                <button
                  onClick={() => {
                    setClearConfirm(true);
                    setShowHeaderMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                  Sohbeti Temizle
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Chat Messages ── */}
      <div className="flex-1 min-h-0 relative">
        <MessageList 
          messages={mappedMessages}
          virtuosoRef={virtuosoRef}
          isLoading={isLoading}
          currentChannel={{ name: otherUser.displayName }}
          handleLoadOlderMessages={() => loadOlderMessages(activeConversation.id)}
          hasMoreMessages={hasMoreMessages}
          isLoadingOlderMessages={isLoadingOlder}
          typingUsers={typingUsers}
          channelId={activeConversation.id}
          userId={user.uid}
          members={dmMembers}
          memberMap={dmMemberMap}
          editingMessageId={editingMessageId}
          editingText={editingText}
          setEditingText={setEditingText}
          handleSaveEdit={handleSaveEdit}
          handleCancelEdit={handleCancelEdit}
          handleToggleReaction={handleToggleReactionLocal}
          handleContextMenu={handleContextMenu}
          renderMessageText={renderMessageText}
          formatTime={formatTime}
          formatDateHeader={formatDateHeader}
          isMessageInSequence={isMessageInSequence}
          setSelectedImage={setSelectedImage}
          isDM={true}
          dmPartner={otherUser}
        />
      </div>

      {/* ── Input ── */}
      {blockState && (
        <div className="px-4 py-3 border-t border-white/[0.06] bg-[#111214] text-center text-xs text-[#949ba4]">
          {blockState === "byMe"
            ? "Bu kullanıcıyı engelledin. Mesaj göndermek için menüden engeli kaldırabilirsin."
            : "Bu kullanıcıya mesaj gönderemezsin."}
        </div>
      )}
      {!blockState && <ChatInput 
        messageInput={inputText}
        setMessageInput={setInputText}
        handleSendMessage={handleSendMessage}
        isSending={isSending}
        pendingImage={pendingImage}
        pendingImageFile={pendingImageFile}
        removePendingImage={() => { setPendingImage(null); setPendingImageFile(null); }}
        inputRef={inputRef}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        emojiPickerRef={emojiPickerRef}
        popularEmojis={popularEmojis}
        handleEmojiClick={(emoji) => {
           const input = inputRef.current;
           const start = input.selectionStart;
           const end = input.selectionEnd;
           const newVal = inputText.substring(0, start) + emoji + inputText.substring(end);
           setInputText(newVal);
           setTimeout(() => input.focus(), 0);
        }}
        handleImageSelect={handleImageSelect}
        fileInputRef={fileInputRef}
        handleMessageInputChange={(e) => setInputText(e.target.value)}
        handlePaste={(e) => {
           const items = e.clipboardData?.items;
           if (!items) return;
           for (const item of items) {
             if (item.type.startsWith('image/')) {
               const file = item.getAsFile();
               const reader = new FileReader();
               reader.onload = (ev) => { setPendingImage(ev.target.result); setPendingImageFile(file); };
               reader.readAsDataURL(file);
             }
           }
        }}
      />}

      {/* Overlays */}
      <ImageOverlay 
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
        imgZoom={imgZoom}
        imgRotation={imgRotation}
        imgPosition={imgPosition}
        imgIsDragging={imgIsDragging}
        imgRef={imgRef}
        handleImgMouseDown={(e) => { e.preventDefault(); setImgIsDragging(true); }}
        handleImgMouseMove={(e) => {
           if (imgIsDragging) setImgPosition(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
        }}
        handleImgMouseUp={() => setImgIsDragging(false)}
        handleImgZoomIn={() => setImgZoom(z => z + 0.2)}
        handleImgZoomOut={() => setImgZoom(z => z - 0.2)}
        handleImgRotate={() => setImgRotation(r => (r + 90) % 360)}
        handleImgReset={() => { setImgZoom(1); setImgRotation(0); setImgPosition({ x: 0, y: 0 }); }}
      />

      <MessageContextMenu 
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        userId={user.uid}
        handleToggleReaction={handleToggleReactionLocal}
        handleCopyText={() => { navigator.clipboard.writeText(contextMenu.message.text); setContextMenu(null); }}
        handleCopyImage={async () => {
          if (contextMenu?.message?.imageUrl) {
            try {
              const img = new Image();
              img.crossOrigin = "anonymous";
              await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = contextMenu.message.imageUrl; });
              const canvas = document.createElement('canvas');
              canvas.width = img.width; canvas.height = img.height;
              const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
              canvas.toBlob(async (blob) => {
                if (blob) {
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                  toast.success("Resim kopyalandı.");
                }
              }, 'image/png');
            } catch (error) { toast.error("Resim kopyalanamadı."); }
          }
          setContextMenu(null);
        }}
        handleCopyImageLink={() => {
          if (contextMenu?.message?.imageUrl) {
            navigator.clipboard.writeText(contextMenu.message.imageUrl);
            toast.success("Resim linki kopyalandı.");
          }
          setContextMenu(null);
        }}
        handleStartEdit={handleStartEdit}
        handleDeleteMsg={handleDeleteMsg}
        handleDeleteSequence={async () => {
          if (!contextMenu?.message) return;
          const result = await deleteMessageSequence(activeConversation.id, contextMenu.message.id);
          if (result.success) toast.success("Mesajlar toplu olarak silindi.");
          else toast.error(result.error || "Silinemedi.");
          setContextMenu(null);
        }}
      />

      <SecurityModal 
        isOpen={linkModal.isOpen}
        url={linkModal.url}
        onClose={() => setLinkModal({ ...linkModal, isOpen: false })}
        onConfirm={() => {
          window.open(linkModal.url, "_blank", "noopener,noreferrer");
          setLinkModal({ isOpen: false, url: "" });
        }}
      />

      <Modal
        isOpen={blockConfirm}
        onClose={() => setBlockConfirm(false)}
        title="Kullanıcıyı Engelle"
        size="sm"
      >
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-[#dbdee1] leading-relaxed">
            <strong className="text-white">{otherUser?.displayName}</strong> isimli kullanıcıyı engellemek istediğine emin misin? Bu işlem sonucunda birbirinize mesaj gönderemeyeceksiniz.
          </p>
          
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={() => setBlockConfirm(false)}
              className="px-4 py-2 text-sm font-semibold text-white hover:underline transition-all"
            >
              Vazgeç
            </button>
            <Button
              variant="danger"
              size="md"
              onClick={async () => {
                const res = await blockUserById(user.uid, otherId);
                setBlockConfirm(false);
                if (res.success) {
                  clearActiveConversation();
                  toast.success("Kullanıcı engellendi.");
                }
              }}
            >
              Engelle
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={removeFriendConfirm}
        onClose={() => setRemoveFriendConfirm(false)}
        title="Arkadaşı Kaldır"
        size="sm"
      >
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-[#dbdee1] leading-relaxed">
            <strong className="text-white">{otherUser?.displayName}</strong> isimli kullanıcıyı arkadaşlarından çıkarmak istediğine emin misin?
          </p>
          
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={() => setRemoveFriendConfirm(false)}
              className="px-4 py-2 text-sm font-semibold text-white hover:underline transition-all"
            >
              Vazgeç
            </button>
            <Button
              variant="danger"
              size="md"
              onClick={async () => {
                const activeFriendship = (friends || []).find(f => f.friendId === otherId);
                if (activeFriendship?.friendshipId) {
                  await removeFriend(activeFriendship.friendshipId);
                  clearActiveConversation();
                  setRemoveFriendConfirm(false);
                  toast.success("Arkadaş listesinden çıkarıldı.");
                }
              }}
            >
              Kaldır
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={clearConfirm}
        onClose={() => setClearConfirm(false)}
        title="Sohbeti Temizle"
        size="sm"
      >
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-[#dbdee1] leading-relaxed">
            Bu sohbetteki tüm mesajları silmek istediğine emin misin? <strong className="text-red-400">Bu işlem geri alınamaz</strong> ve mesajlar her iki taraftan da kalıcı olarak silinir.
          </p>
          
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={() => setClearConfirm(false)}
              className="px-4 py-2 text-sm font-semibold text-white hover:underline transition-all"
            >
              Vazgeç
            </button>
            <Button
              variant="danger"
              size="md"
              onClick={handleClearChat}
            >
              Tümünü Temizle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
