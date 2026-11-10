import { Smile, Paperclip, Send, Trash2, AlertTriangle, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatInput({
  messageInput,
  setMessageInput,
  handleSendMessage,
  isSending,
  cooldownRemaining,
  pendingImage,
  pendingImageFile,
  removePendingImage,
  inputRef,
  showEmojiPicker,
  setShowEmojiPicker,
  emojiPickerRef,
  popularEmojis,
  handleEmojiClick,
  handleImageSelect,
  fileInputRef,
  handleMessageInputChange,
  handlePaste
}) {
  return (
    <div className="px-2 sm:px-6 pb-2 pt-2 bg-[#0e0f12] border-t border-white/[0.05] shrink-0 z-20 mt-auto">
      <AnimatePresence>
        {pendingImage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="mb-4 bg-[#1e1f22]/80 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 flex items-start gap-4 shadow-2xl relative max-w-fit mx-auto sm:mx-0 overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <img src={pendingImage} alt="Preview" className="h-32 sm:h-40 rounded-xl object-contain bg-black/40 border border-white/5 shadow-inner" />
              <button
                onClick={removePendingImage}
                className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1.5 shadow-lg hover:bg-rose-600 transition hover:scale-110 active:scale-95 z-10 border border-white/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-white text-sm font-bold truncate max-w-[150px] tracking-tight">
                {pendingImageFile?.name && (pendingImageFile.name.startsWith("{") || pendingImageFile.name.match(/^[0-9a-fA-F-]{36}/) || pendingImageFile.name === "image.png")
                  ? "Pano Resmi (Yapıştırıldı)"
                  : pendingImageFile?.name || "Eklenen Resim"}
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 w-fit">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Hazır</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cooldown Banner */}
      <AnimatePresence>
        {cooldownRemaining > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-4 bg-gradient-to-r from-rose-500/20 via-rose-600/15 to-transparent backdrop-blur-md border border-rose-500/20 rounded-2xl px-5 py-3.5 flex items-center gap-4 shadow-lg"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-500/30">
              <AlertTriangle size={18} className="text-rose-400" />
            </div>
            <div className="flex flex-col">
              <p className="text-white font-bold text-sm tracking-tight">Yavaş ol şampiyon!</p>
              <p className="text-rose-400/80 text-xs font-medium">
                Sohbeti korumak için <span className="text-rose-400 font-bold underline underline-offset-2">{cooldownRemaining} saniye</span> beklemelisin.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSendMessage}
        className="relative group"
      >
        {/* Animated Background Border */}
        <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-indigo-500/40 rounded-[1.25rem] opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-[2px] pointer-events-none" />
        
        <div className="relative flex items-center gap-2 bg-[#1e1f22] border border-white/[0.05] rounded-[1.25rem] p-1.5 transition duration-300 focus-within:bg-[#232428] shadow-2xl">
          
          <div className="flex items-center gap-1 pl-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
              accept="image/*"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 flex items-center justify-center text-[#b5bac1] hover:text-white hover:bg-white/5 rounded-xl transition duration-200 group/btn"
              title="Resim Ekle"
            >
              <PlusCircle size={20} className="group-hover/btn:scale-110 transition-transform" />
            </button>
            <button
              type="button"
              data-emoji-button
              onClick={(e) => {
                e.stopPropagation();
                setShowEmojiPicker(!showEmojiPicker);
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition duration-200 group/btn ${
                showEmojiPicker
                   ? "text-yellow-400 bg-yellow-400/10 shadow-inner shadow-yellow-400/5 cursor-default"
                   : "text-[#b5bac1] hover:text-yellow-100 hover:bg-white/5"
              }`}
              title="Emoji"
            >
              <Smile size={20} className={`${showEmojiPicker ? 'scale-110' : 'group-hover/btn:scale-110'} transition-transform`} />
            </button>
          </div>

          <div className="flex-1 min-w-0 flex items-center">
            <textarea
              ref={inputRef}
              rows="1"
              value={messageInput}
              onChange={handleMessageInputChange}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Bir mesaj gönder..."
              className="w-full bg-transparent text-white text-[15px] outline-none placeholder:text-[#5c5e66] max-h-40 resize-none py-2 px-2 font-medium scrollbar-none"
              style={{ height: 'auto' }}
            />
          </div>

          <div className="pr-1 flex items-center">
            <button
              type="submit"
              disabled={(!messageInput.trim() && !pendingImageFile) || isSending || cooldownRemaining > 0}
              className={`
                w-10 h-10 rounded-xl transition duration-300 flex items-center justify-center relative overflow-hidden group/send
                ${
                  (!messageInput.trim() && !pendingImageFile) || isSending || cooldownRemaining > 0
                    ? "bg-white/5 text-white/10 cursor-not-allowed"
                    : "bg-indigo-500 text-white shadow-[0_4px_15px_rgba(99,102,241,0.3)] hover:bg-indigo-600 hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] active:scale-95"
                }
              `}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover/send:opacity-100 transition-opacity" />
              <Send size={18} className={`${(!messageInput.trim() && !pendingImageFile) ? '' : 'group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5'} transition-transform`} />
            </button>
          </div>
        </div>

        {/* Emoji Picker Layout (Refined) */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              ref={emojiPickerRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute bottom-full left-0 mb-4 w-[320px] sm:w-[380px] bg-[#1e1f22]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden z-[60]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] pl-1">Hızlı Emoji Seçimi</span>
              </div>
              <div className="h-64 overflow-y-auto p-4 scrollbar-thin">
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-2">
                  {popularEmojis.map((emoji, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => handleEmojiClick(emoji, e)}
                      className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/10 rounded-[12px] transition duration-200 hover:scale-125 active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
