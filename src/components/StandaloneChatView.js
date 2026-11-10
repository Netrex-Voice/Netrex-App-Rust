"use client";

/**
 * 💬 StandaloneChatView - Chat View Wrapper for use outside LiveKitRoom
 * Wraps ChatView for standalone use when user is not in a voice channel
 */

import ChatView from "@/src/components/ChatView";
import { useChatStore } from "@/src/store/chatStore";
import { useServerStore } from "@/src/store/serverStore";
import { useMemo } from "react";
import { Hash, MessageSquare, ChevronLeft, Users } from "lucide-react";

export default function StandaloneChatView({ channelId, username, userId, onBack }) {
  const { currentChannel } = useChatStore();
  const { channels, currentServer, setMobileMemberDrawerOpen } = useServerStore();
  
  const channelName = useMemo(() => {
    if (currentChannel?.name) return currentChannel.name;
    const channel = channels.find(c => c.id === channelId);
    return channel?.name || "-";
  }, [currentChannel, channels, channelId]);

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12]">
      {/* Header - Settings Modal Style */}
      <div className="relative z-10 px-4 sm:px-5 py-3 border-b border-white/[0.06] bg-gradient-to-r from-[#1e1f22]/95 to-transparent backdrop-blur-sm flex-shrink-0">
        {/* Top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Back Button */}
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-[#949ba4] hover:text-white transition-colors flex-shrink-0 mr-1"
                title="Kanallara Dön"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {/* Icon container with gradient */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/10 flex-shrink-0">
              <Hash className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <span className="text-white font-bold text-sm sm:text-[15px] tracking-tight truncate block">{channelName}</span>
              <span className="text-[10px] sm:text-[11px] text-[#949ba4] font-medium hidden xs:block">Metin Kanalı</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Member List Button (Mobile & Desktop) */}
            {currentServer && (
              <button
                onClick={() => setMobileMemberDrawerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.05] text-[#949ba4] hover:text-white transition-all text-xs font-semibold shadow-sm active:scale-95"
                title="Sunucu Üyelerini Göster"
              >
                <Users className="w-4 h-4 text-indigo-400" />
                <span className="hidden xs:inline">Üyeler</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <MessageSquare className="w-3.5 h-3.5 text-[#949ba4]" />
              <span className="text-[11px] text-[#949ba4] font-medium hidden sm:inline">Sohbet</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chat Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatView 
          channelId={channelId} 
          username={username} 
          userId={userId}
        />
      </div>
    </div>
  );
}
