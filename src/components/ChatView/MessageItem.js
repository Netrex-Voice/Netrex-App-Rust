import { memo } from "react";
import { MESSAGE_SEQUENCE_THRESHOLD } from "@/src/constants/appConfig";
import Avatar from "@/src/components/ui/Avatar";

const extractYouTubeIds = (text) => {
  if (!text) return [];
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  const ids = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1] && !ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  return ids;
};

const MessageItem = memo(({ 
  message, 
  prevMessage, 
  messageIndex, 
  onContextMenu, 
  renderText, 
  formatTime, 
  formatDateHeader, 
  isInSequence,
  isContinuation,
  onImageClick
}) => {
  const msgDate = message.timestamp?.toDate ? message.timestamp.toDate() : new Date(message.timestamp);
  const prevMsgDate = prevMessage?.timestamp?.toDate ? prevMessage.timestamp.toDate() : (prevMessage ? new Date(prevMessage.timestamp) : null);

  // isInSequence yalnızca sağ tık menüsü içindir (önceki VEYA sonraki mesaj); başlık gizleme isContinuation ile yapılır
  const isSequence =
    isContinuation !== undefined ? isContinuation : (
      prevMessage &&
      prevMessage.userId === message.userId &&
      msgDate.getTime() >= prevMsgDate.getTime() &&
      (msgDate.getTime() - prevMsgDate.getTime()) < MESSAGE_SEQUENCE_THRESHOLD
    );

  const showDateSeparator =
    !prevMessage ||
    msgDate.toDateString() !== prevMsgDate.toDateString();

  return (
    <div className="relative group/message">
      {/* TARİH AYIRICI */}
      {showDateSeparator && (
        <div className="relative flex items-center justify-center my-6 select-none animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.05]"></div>
          </div>
          <span className="relative bg-[#1e1f22] px-3 py-1 rounded-full text-[11px] font-bold text-[#949ba4] border border-white/[0.05] shadow-sm uppercase tracking-wider">
            {formatDateHeader(message.timestamp)}
          </span>
        </div>
      )}

      {/* MESAJ KARTI */}
      <div
        className={`
          group flex pr-4 pl-[72px] relative w-full
          ${!isSequence ? "mt-[17px]" : "mt-[2px]"}
          hover:bg-white/[0.03] -mx-4 px-4 py-0.5 transition duration-75
        `}
        onContextMenu={(e) => onContextMenu(e, message, isInSequence)}
      >
        {/* SOL TARA: AVATAR VEYA SAAT */}
        <div className="absolute left-4 w-[50px] flex justify-start select-none">
          {!isSequence || showDateSeparator ? (
            <Avatar
              uid={message.userId || message.member?.id || message.member?.userId}
              src={message.member?.photoURL || null}
              name={message.member?.displayName || message.username}
              size="md"
              borderColor={message.member?.profileColor || message.member?.color}
            />
          ) : (
            <span className="text-[10px] text-[#949ba4] hidden group-hover:inline-block w-full text-left pl-2 mt-1.5 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>

        {/* SAĞ TARA: İÇERİK */}
        <div className="flex-1 min-w-0">
          {(!isSequence || showDateSeparator) && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[15px] font-bold text-white hover:underline cursor-pointer tracking-tight">
                {message.username}
              </span>
              <span className="text-[11px] text-[#949ba4] font-bold ml-1 select-none uppercase tracking-tighter opacity-60">
                {formatTime(message.timestamp)}
              </span>
            </div>
          )}
          
          {message.type === 'image' && message.imageUrl && (
              <div className="mt-1.5 mb-2 max-w-[320px] sm:max-w-[450px] overflow-hidden rounded-2xl shadow-xl border border-white/10 bg-black/20 group/image relative">
                  <img 
                    src={message.imageUrl} 
                    alt="Uploaded content" 
                    className="w-full h-auto max-h-[300px] sm:max-h-[450px] object-cover hover:scale-[1.01] transition-transform duration-300 ease-ui-out cursor-zoom-in"
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageClick(message.imageUrl);
                    }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/5 transition-colors pointer-events-none" />
              </div>
          )}
          
          {message.text && (
            <div className="relative">
              {/* EDITING UI */}
              {message.isEditing ? (
                <div className="mt-1 animate-in fade-in duration-200">
                  <div className="relative group/edit">
                    <textarea
                      autoFocus
                      className="w-full bg-[#1e1f22] text-[#dcddde] text-[14px] p-3 rounded-xl border border-indigo-500/50 outline-none focus:ring-4 focus:ring-indigo-500/10 transition duration-300 min-h-[44px] max-h-[300px] resize-none overflow-hidden"
                      value={message.tempText}
                      onChange={(e) => message.onTempTextChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          message.onSave();
                        } else if (e.key === "Escape") {
                          message.onCancel();
                        }
                      }}
                    />
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold">
                      <span className="text-[#949ba4] uppercase tracking-wider">vazgeçmek için</span>
                      <button onClick={message.onCancel} className="text-indigo-400 hover:underline">ESC</button>
                      <span className="text-[#949ba4] mx-0.5">•</span>
                      <span className="text-[#949ba4] uppercase tracking-wider">kaydetmek için</span>
                      <button onClick={message.onSave} className="text-indigo-400 hover:underline">ENTER</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p
                    className={`
                      text-[14px] leading-[1.4] whitespace-pre-wrap break-words font-medium
                      ${isSequence ? "text-[#dbdee1]" : "text-[#dcddde]"}
                    `}
                  >
                    {renderText(message.text)}
                    {message.edited && (
                      <span className="text-[10px] text-[#949ba4] ml-1.5 select-none font-bold uppercase opacity-60 tracking-tighter">
                        (düzenlendi)
                      </span>
                    )}
                  </p>
                  
                  {/* YOUTUBE EMBEDS */}
                  {(() => {
                    const youtubeIds = extractYouTubeIds(message.text);
                    if (youtubeIds.length > 0) {
                      return (
                        <div className="mt-3 flex flex-col gap-3">
                          {youtubeIds.map(id => (
                            <div key={id} className="relative w-[360px] max-w-full rounded-xl overflow-hidden border border-white/5 bg-[#111214] shadow-md">
                              <iframe
                                width="100%"
                                height="200"
                                src={`https://www.youtube.com/embed/${id}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="block"
                              ></iframe>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}

              {/* REACTIONS */}
              {message.reactions && Object.keys(message.reactions).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 select-none">
                  {Object.entries(message.reactions).map(([emoji, userIds]) => {
                    const hasReacted = userIds.includes(message.currentUserId);
                    return (
                      <button
                        key={emoji}
                        onClick={(e) => {
                            e.stopPropagation();
                            message.onToggleReaction(emoji);
                        }}
                        className={`
                          flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition duration-200
                          ${hasReacted 
                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" 
                            : "bg-white/5 border-white/5 text-[#949ba4] hover:bg-white/10 hover:border-white/10"}
                        `}
                        title={userIds.length > 5 ? `${userIds.length} kişi` : ""}
                      >
                        <span className="text-[15px]">{emoji}</span>
                        <span className={`text-[11px] font-bold ${hasReacted ? "text-indigo-300" : "text-[#949ba4]"}`}>
                          {userIds.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
         </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';
export default MessageItem;
