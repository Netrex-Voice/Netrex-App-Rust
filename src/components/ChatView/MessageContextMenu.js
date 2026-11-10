import { createPortal } from "react-dom";
import { Send, Copy, ImageIcon, Trash2, Mic, VolumeX } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function MessageContextMenu({
  contextMenu,
  setContextMenu,
  userId,
  handleToggleReaction,
  handleCopyText,
  handleCopyImage,
  handleCopyImageLink,
  handleStartEdit,
  handleDeleteMsg,
  handleDeleteSequence
}) {
  const ttsEnabled = useSettingsStore(state => state.ttsEnabled);
  const mutedTtsUsers = useSettingsStore(state => state.mutedTtsUsers);
  const toggleMutedTtsUser = useSettingsStore(state => state.toggleMutedTtsUser);

  if (!contextMenu) return null;

  return createPortal(
    <>
      {/* Background Overlay to close on click outside */}
      <div 
        className="fixed inset-0 z-[99998] bg-transparent cursor-default"
        onClick={() => setContextMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu(null);
        }}
      />
      
      <div
        className="fixed z-[99999] w-52 bg-[#111214]/95 border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] py-2 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-xl overflow-hidden"
        style={{ 
          top: contextMenu.y + 220 > window.innerHeight ? 'auto' : contextMenu.y,
          bottom: contextMenu.y + 220 > window.innerHeight ? window.innerHeight - contextMenu.y : 'auto',
          left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 216)) 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* QUICK REACTIONS */}
        <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-white/5">
          {["👍", "❤️", "😂", "😮", "😢", "🔥"].map(emoji => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleReaction(contextMenu.message.id, emoji);
                setContextMenu(null);
              }}
              className="hover:bg-white/10 p-1.5 rounded-lg transition-colors text-lg hover:scale-125 active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>

        {ttsEnabled && contextMenu.message.userId !== userId && (
          <div
            className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors border-b border-white/5 mb-1 pb-1.5"
            onClick={() => { 
              toggleMutedTtsUser(contextMenu.message.userId); 
              setContextMenu(null); 
            }}
          >
            {mutedTtsUsers.includes(contextMenu.message.userId) ? (
              <>
                <Mic size={16} className="text-green-400 group-hover:text-white" />
                <span className="font-medium">Kullanıcının Sesini Aç</span>
              </>
            ) : (
              <>
                <VolumeX size={16} className="text-[#b5bac1] group-hover:text-white" />
                <span className="font-medium">Kullanıcıyı Sustur (TTS)</span>
              </>
            )}
          </div>
        )}

        {contextMenu.message.type === 'image' ? (
          <>
            <div
              className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
              onClick={() => { handleCopyImage(); setContextMenu(null); }}
            >
               <ImageIcon size={16} className="text-[#b5bac1] group-hover:text-white" />
               <span className="font-medium">Resmi Kopyala</span>
            </div>
            <div
              className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
              onClick={() => { handleCopyImageLink(); setContextMenu(null); }}
            >
               <Copy size={16} className="text-[#b5bac1] group-hover:text-white" />
               <span className="font-medium">Bağlantıyı Kopyala</span>
            </div>
          </>
        ) : (
          <div
            className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
            onClick={() => { handleCopyText(); setContextMenu(null); }}
          >
            <Copy size={16} className="text-[#b5bac1] group-hover:text-white" />
            <span className="font-medium">Metni Kopyala</span>
          </div>
        )}

        {contextMenu.message.userId === userId && (
          <>
            <div className="h-[1px] bg-[#1e1f22] my-1 mx-2"></div>
            {contextMenu.message.text && (
              <div
                className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
                onClick={() => { handleStartEdit(contextMenu.message); setContextMenu(null); }}
              >
                 <Send size={16} className="text-[#b5bac1] group-hover:text-white" />
                 <span className="font-medium">Mesajı Düzenle</span>
              </div>
            )}
            <div
              className="mx-2 px-2 py-1.5 hover:bg-[#da373c] hover:text-white rounded cursor-pointer flex items-center gap-2 group text-[#da373c] select-none transition-colors"
              onClick={() => { handleDeleteMsg(); setContextMenu(null); }}
            >
              <Trash2 size={16} className="group-hover:text-white" />
              <span className="font-medium">Mesajı Sil</span>
            </div>
            {contextMenu.isInSequence && (
               <div
                 className="mx-2 px-2 py-1.5 hover:bg-[#da373c] hover:text-white rounded cursor-pointer flex items-center gap-2 group text-[#da373c] select-none transition-colors"
                 onClick={() => { handleDeleteSequence(); setContextMenu(null); }}
               >
                 <Trash2 size={16} className="group-hover:text-white" />
                 <span className="font-medium text-xs">Toplu Sil</span>
               </div>
            )}
          </>
        )}
      </div>
    </>,
    document.body
  );
}
