import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { Loader2, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MessageItem from "./MessageItem";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";

export default function MessageList({
  messages,
  virtuosoRef,
  isLoading,
  currentChannel,
  handleLoadOlderMessages,
  hasMoreMessages,
  isLoadingOlderMessages,
  typingUsers,
  channelId,
  userId,
  members = [],
  // ✅ CPU OPT: O(n) find → O(1) Map lookup (500 mesaj × 100 üye = 50K → 500 karşılaştırma tasarrufu)
  _memberMapInternal,
  editingMessageId,
  editingText,
  setEditingText,
  handleSaveEdit,
  handleCancelEdit,
  handleToggleReaction,
  handleContextMenu,
  renderMessageText,
  formatTime,
  formatDateHeader,
  isMessageInSequence,
  // Görsel birleştirme için (yalnızca geriye bakar). Verilmezse (DM) isMessageInSequence zaten geriye bakar.
  isMessageContinuation,
  setSelectedImage,
  // ✅ CPU OPT: memberMap'i burada oluştur - her mesaj render'ında find() yerine Map.get() kullanılacak
  memberMap: memberMapProp,
  isDM,
  dmPartner
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full py-6 overflow-hidden px-4">
        <AnimatePresence>
          {[...Array(6)].map((_, i) => (
            <motion.div 
              key={`skeleton-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex pr-4 pl-[72px] relative w-full ${i % 3 === 0 ? 'mt-[17px]' : 'mt-[2px]'}`}
            >
              {i % 3 === 0 && (
                <div className="absolute left-4 w-[50px] flex justify-start">
                  <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {i % 3 === 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 rounded-md bg-white/10 animate-pulse w-24" />
                  </div>
                )}
                <div className="h-4 rounded-md bg-white/[0.05] animate-pulse w-[70%]" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  if (messages.length === 0) {
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col justify-end pb-12 select-none px-4"
      >
        <div className="w-20 h-20 relative mb-6 group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-cyan-500/10 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative w-20 h-20 bg-[#1e1f22] rounded-3xl flex items-center justify-center shadow-2xl border border-white/10 backdrop-blur-sm overflow-hidden">
            {isDM ? (
              <UserPhoto
                uid={dmPartner?.uid || dmPartner?.id}
                src={dmPartner?.photoURL}
                className="w-full h-full object-cover"
                fallback={
                  <AvatarFallback
                    name={dmPartner?.displayName}
                    color={dmPartner?.profileColor}
                    className="w-full h-full"
                    textClassName="text-3xl font-bold"
                  />
                }
              />
            ) : (
              <Hash size={44} className="text-white/90" />
            )}
          </div>
          {isDM && (
            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-[#141518] ${({ online: 'bg-green-500', idle: 'bg-yellow-500', dnd: 'bg-red-500' })[getEffectivePresence(dmPartner)] || 'bg-gray-500'}`} />
          )}
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
          {isDM ? `${dmPartner?.displayName} kişisine hoş geldin!` : `${currentChannel?.name || "sohbet"} kanalına hoş geldin!`}
        </h1>
        <p className="text-white/60 text-base max-w-lg leading-relaxed">
          {isDM 
            ? `Burası ${dmPartner?.displayName} ile sohbetinin başlangıcı. Bir mesaj göndererek sohbeti başlatabilirsin!`
            : "Bu kanalın başlangıcı. Arkadaşlarına bir \"Merhaba\" diyerek sohbeti başlatabilirsin."}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full"
    >
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={messages}
        initialTopMostItemIndex={messages.length - 1}
        followOutput="smooth"
        startReached={handleLoadOlderMessages}
        atTopThreshold={50}
        className="scrollbar-thin"
        components={{
          Header: () => (
            (hasMoreMessages || isLoadingOlderMessages) ? (
              <div className="py-4 flex justify-center w-full">
                <div className="px-4 py-1.5 text-xs font-semibold text-[#949ba4] bg-white/5 rounded-full border border-white/5 flex items-center gap-2">
                  {isLoadingOlderMessages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {isLoadingOlderMessages ? "Yükleniyor..." : "Daha eski mesajları yüklemek için yukarı kaydır"}
                </div>
              </div>
            ) : <div className="h-4" />
          ),
          Footer: () => (
            <div className="pb-2">
              <AnimatePresence>
                {Object.keys(typingUsers[channelId] || {}).length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="px-12 py-2 flex items-center gap-2"
                  >
                    <div className="flex gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>
                    <span className="text-[11px] text-[#949ba4] font-bold italic">
                      {Object.values(typingUsers[channelId]).join(", ")} yazıyor...
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div id="chat-bottom-anchor" className="h-4 w-full scroll-mt-20" />
            </div>
          )
        }}
        itemContent={(index, message) => {
          const member = memberMapProp?.get(message.userId) || members.find((m) => m.id === message.userId);
          return (
            <div className="px-4">
              <MessageItem
                key={message.id}
                message={{
                  ...message,
                  currentUserId: userId,
                  isEditing: editingMessageId === message.id,
                  tempText: editingText,
                  onTempTextChange: setEditingText,
                  onSave: handleSaveEdit,
                  onCancel: handleCancelEdit,
                  onToggleReaction: (emoji) => handleToggleReaction(message.id, emoji),
                  member,
                }}
                prevMessage={messages[index - 1]}
                messageIndex={index}
                onContextMenu={handleContextMenu}
                renderText={renderMessageText}
                formatTime={formatTime}
                formatDateHeader={formatDateHeader}
                isInSequence={isMessageInSequence(message, index)}
                isContinuation={(isMessageContinuation || isMessageInSequence)(message, index)}
                onImageClick={setSelectedImage}
              />
            </div>
          );
        }}
      />
    </motion.div>
  );
}
