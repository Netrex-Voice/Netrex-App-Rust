import { memo } from "react";
import { Clock, Gamepad2 } from "lucide-react";
import GameDuration from "@/src/components/ui/GameDuration";
import GameIcon from "@/src/components/ui/GameIcon";

/**
 * ✅ GameActivityCard - Isolated component
 * Re-renders only when game activity changes
 */
const GameActivityCard = memo(({ gameActivity }) => {
  if (!gameActivity) return null;

  return (
    <div>
      <h4 className="text-[11px] font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-1.5">
        <Gamepad2 size={12} /> Aktivite
      </h4>
      <div className="relative rounded-xl p-0.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/10 group/game">
        <div className="bg-[#111214]/95 backdrop-blur-xl rounded-[10px] p-3 h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-[50px] rounded-full translate-x-10 -translate-y-10"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative">
              <GameIcon 
                iconUrl={gameActivity.iconUrl} 
                icon={gameActivity.icon}
                name={gameActivity.name}
                className="w-12 h-12 rounded-lg object-cover shadow-md"
                emojiClassName="text-3xl"
              />
              <div className="absolute -bottom-1 -right-1 bg-green-500 border-[2px] border-[#111214] w-3.5 h-3.5 rounded-full"></div>
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 uppercase tracking-wide mb-0.5">Oynuyor</div>
              <div className="text-sm font-bold text-white truncate">{gameActivity.name}</div>
              <div className="text-xs text-[#949ba4] flex items-center gap-1.5 mt-0.5">
                <Clock size={10} />
                <GameDuration startTime={gameActivity.startedAt} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.gameActivity?.name === nextProps.gameActivity?.name &&
    prevProps.gameActivity?.startedAt === nextProps.gameActivity?.startedAt
  );
});

GameActivityCard.displayName = 'GameActivityCard';

export default GameActivityCard;
