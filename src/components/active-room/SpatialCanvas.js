import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { useParticipants } from '@livekit/components-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Radar,
  Grid3X3,
  RotateCcw,
  Save,
  Trash2,
  Play,
  X,
  ChevronDown,
  Maximize2,
  Minimize2,
  Circle
} from 'lucide-react';
import { useSpatialAudioStore } from '@/src/store/spatialAudioStore';
import { useSpeakingStore } from '@/src/store/speakingStore';
import UserPhoto from '@/src/components/ui/UserPhoto';
import { AvatarFallback } from '@/src/components/ui/Avatar';
import { useSettingsStore } from '@/src/store/settingsStore';
import {
  calculateAudioFromPosition,
  resolveLayout,
  defaultLayout,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '@/src/utils/spatialMath';

// ──────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────
const AVATAR_RADIUS = 28;
const AVATAR_DIAMETER = AVATAR_RADIUS * 2;
const MIN_DISTANCE = AVATAR_DIAMETER + 4; // Collision detection minimum mesafe
const GRID_SIZE_DEFAULT = 20;

// ──────────────────────────────────────────────────
// AVATAR COMPONENT
// ──────────────────────────────────────────────────
const SpatialAvatar = memo(({
  userId,
  displayName,
  photoURL,
  profileColor,
  x,
  y,
  isLocal,
  isSpeaking,
  isDragging,
  audioValues,
  onDragStart,
  onDrag,
  onDragEnd,
}) => {
  const avatarRef = useRef(null);

  // Konuşma göstergesi rengi
  const speakingColor = profileColor || '#6366f1';
  const initial = (displayName || userId || '?').charAt(0).toUpperCase();

  // Audio debug bilgileri
  const gainPercent = audioValues ? Math.round(audioValues.spatialGain * 100) : 100;
  const panLabel = audioValues 
    ? audioValues.pan < -0.3 ? 'L' : audioValues.pan > 0.3 ? 'R' : 'C'
    : 'C';

  return (
    <div
      ref={avatarRef}
      className={`absolute select-none ${isLocal ? 'cursor-default z-20' : 'cursor-grab active:cursor-grabbing z-30'}`}
      style={{
        left: x - AVATAR_RADIUS,
        top: y - AVATAR_RADIUS,
        width: AVATAR_DIAMETER,
        height: AVATAR_DIAMETER,
        transition: isDragging ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out',
      }}
      onMouseDown={!isLocal ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragStart?.(userId, e);
      } : undefined}
      onTouchStart={!isLocal ? (e) => {
        e.stopPropagation();
        const touch = e.touches[0];
        onDragStart?.(userId, { clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
      } : undefined}
    >
      {/* Speaking glow ring */}
      {isSpeaking && (
        <div
          className="absolute -inset-2 rounded-full animate-pulse opacity-50"
          style={{
            background: `radial-gradient(circle, ${speakingColor}40 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Spatial range indicator */}
      {!isLocal && audioValues && (
        <div
          className="absolute rounded-full border pointer-events-none"
          style={{
            inset: -4,
            borderColor: `${speakingColor}${Math.round(audioValues.spatialGain * 40).toString(16).padStart(2, '0')}`,
            opacity: isDragging ? 0.8 : 0.4,
            transition: 'opacity 0.2s',
          }}
        />
      )}

      {/* Avatar circle */}
      <div
        className={`w-full h-full rounded-full overflow-hidden border-2 shadow-lg relative ${
          isLocal 
            ? 'border-indigo-500/60 ring-2 ring-indigo-500/20' 
            : isDragging 
              ? 'border-white/60 ring-2 ring-white/20 scale-110' 
              : 'border-white/20 hover:border-white/40'
        }`}
        style={{
          transition: isDragging ? 'none' : 'border-color 0.2s, transform 0.15s',
          transform: isDragging ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        <UserPhoto
          uid={userId}
          src={photoURL}
          alt={displayName}
          className="w-full h-full object-cover"
          draggable={false}
          fallback={
            <AvatarFallback
              name={displayName || userId}
              color={profileColor}
              className="w-full h-full"
              textClassName="text-sm font-bold"
            />
          }
        />

        {/* Local badge */}
        {isLocal && (
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[7px] font-black px-1.5 py-0 rounded-full uppercase tracking-widest shadow-lg">
            Sen
          </div>
        )}
      </div>

      {/* Name label */}
      <div
        className={`absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
          isLocal 
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20' 
            : 'bg-black/60 text-white/80 border border-white/10'
        }`}
      >
        {displayName || userId}
      </div>

      {/* Audio info badge (spatial effect indicators) */}
      {!isLocal && audioValues && !isDragging && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <span className={`text-[8px] font-mono px-1 py-0 rounded ${
            gainPercent > 70 ? 'bg-emerald-500/20 text-emerald-400' :
            gainPercent > 30 ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {gainPercent}%
          </span>
          <span className="text-[8px] font-mono px-1 py-0 rounded bg-white/10 text-white/60">
            {panLabel}
          </span>
        </div>
      )}
    </div>
  );
});
SpatialAvatar.displayName = 'SpatialAvatar';

// ──────────────────────────────────────────────────
// PRESET PANEL
// ──────────────────────────────────────────────────
const PresetPanel = memo(({ channelId, participantCount, localUserId, participantIds }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [presetName, setPresetName] = useState('');
  const customPresets = useSpatialAudioStore(s => s.customPresets);
  const savePreset = useSpatialAudioStore(s => s.savePreset);
  const applyPreset = useSpatialAudioStore(s => s.applyPreset);
  const deletePreset = useSpatialAudioStore(s => s.deletePreset);
  const setPositions = useSpatialAudioStore(s => s.setPositions);
  const resetPositions = useSpatialAudioStore(s => s.resetPositions);

  const handleDistributeEvenly = useCallback(() => {
    if (!channelId || !participantIds || participantIds.length <= 1) return;

    // Odadaki HERKESİ çember üzerine eşit dağıt (yerel kullanıcı merkezde kalır, dinleyici odur).
    // Eşit dağıtım varsayılan yerleşimle aynıdır, ama burada açıkça KAYDEDİLİR (oda kalabalığı değişse de kişiler yerinde kalır).
    setPositions(channelId, defaultLayout(participantIds, localUserId));
  }, [channelId, participantIds, setPositions, localUserId]);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim() || !channelId) return;
    savePreset(presetName.trim(), channelId);
    setPresetName('');
  }, [presetName, channelId, savePreset]);

  const filteredPresets = useMemo(() => 
    customPresets.filter(p => p.channelId === channelId),
    [customPresets, channelId]
  );

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-[10px] font-semibold"
        title="Preset'ler"
      >
        <Play size={10} />
        Preset
        <ChevronDown size={10} className={`transition-transform ${showPanel ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-56 bg-[#111214]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {/* Built-in Presets */}
            <div className="p-2 border-b border-white/5">
              <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold px-1">Hazır</span>
              <button
                onClick={() => resetPositions(channelId)}
                className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
              >
                <RotateCcw size={11} /> Varsayılan (Çember)
              </button>
              <button
                onClick={handleDistributeEvenly}
                className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
              >
                <Circle size={11} /> Eşit Dağıt
              </button>
            </div>

            {/* Custom Presets */}
            {filteredPresets.length > 0 && (
              <div className="p-2 border-b border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold px-1">Kaydedilmiş</span>
                {filteredPresets.map(preset => (
                  <div key={preset.id} className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => applyPreset(preset.id, channelId)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all text-left truncate"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="p-1 rounded-md hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Save Current */}
            <div className="p-2">
              <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold px-1">Kaydet</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                  placeholder="Preset adı..."
                  className="flex-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white text-[11px] placeholder:text-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                  maxLength={20}
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 transition-all disabled:opacity-30"
                >
                  <Save size={11} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
PresetPanel.displayName = 'PresetPanel';

// ──────────────────────────────────────────────────
// MAIN SPATIAL CANVAS COMPONENT
// ──────────────────────────────────────────────────
export default function SpatialCanvas({ channelId, localUserId, onUpdatePosition, isExpanded, onToggleExpand, dragControls, onClose }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const participants = useParticipants();
  
  // Store selectors
  const snapToGrid = useSpatialAudioStore(s => s.snapToGrid);
  const toggleSnapToGrid = useSpatialAudioStore(s => s.toggleSnapToGrid);
  const gridSize = useSpatialAudioStore(s => s.gridSize);
  const positions = useSpatialAudioStore(s => s.positions);
  const setPosition = useSpatialAudioStore(s => s.setPosition);
  const resetPositions = useSpatialAudioStore(s => s.resetPositions);

  // Drag state
  const [draggingUser, setDraggingUser] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tempPosition, setTempPosition] = useState(null);

  // Canvas boyutu
  const canvasWidth = isExpanded ? CANVAS_WIDTH : 320;
  const canvasHeight = isExpanded ? CANVAS_HEIGHT : 320;
  const scale = canvasWidth / CANVAS_WIDTH;

  // ──────────────────────────────────────────────────
  // Participant bilgilerini topla
  // ──────────────────────────────────────────────────
  const identities = useMemo(() => participants.map(p => p.identity), [participants]);
  const speakingMap = useSpeakingStore((s) => s.speakingParticipants);
  const localIsSpeaking = useSettingsStore((s) => s.localIsSpeaking);

  // Geçerli yerleşim: kaydedilmiş konum varsa o, yoksa varsayılan çember. Yerel kullanıcı her zaman merkezde.
  // (Motor aynı fonksiyonu kullanır; ekranda gördüğün = kulağına gelen.)
  const layout = useMemo(
    () => resolveLayout(positions[channelId], identities, localUserId),
    [positions, channelId, identities, localUserId],
  );

  const participantData = useMemo(() => {
    return participants.map(p => {
      let metadata = {};
      try {
        metadata = p.metadata ? JSON.parse(p.metadata) : {};
      } catch (e) {}

      const isLocal = p.identity === localUserId;
      const pos = layout[p.identity] || { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

      return {
        userId: p.identity,
        displayName: metadata.displayName || p.name || p.identity,
        photoURL: metadata.photoURL || null,
        profileColor: metadata.profileColor || '#6366f1',
        // Yerel: anlık VAD; uzak: gelen sesten ölçülen değer (UserCard yazar). Yoksa LiveKit'in (gecikmeli) değerine düş.
        isSpeaking: isLocal ? localIsSpeaking : (speakingMap[p.identity] ?? p.isSpeaking),
        isLocal,
        x: pos.x,
        y: pos.y,
      };
    });
  }, [participants, layout, localUserId, speakingMap, localIsSpeaking]);


  // ──────────────────────────────────────────────────
  // Collision Detection
  // ──────────────────────────────────────────────────
  const findNearestFreePosition = useCallback((targetX, targetY, draggedUserId) => {
    const otherPositions = Object.entries(layout)
      .filter(([id]) => id !== draggedUserId)
      .map(([, pos]) => pos);

    // Collision kontrolü
    const hasCollision = (px, py) => {
      return otherPositions.some(pos => {
        const dist = Math.sqrt(Math.pow(px - pos.x, 2) + Math.pow(py - pos.y, 2));
        return dist < MIN_DISTANCE;
      });
    };

    // Snap to grid
    let x = targetX;
    let y = targetY;

    if (snapToGrid) {
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    // Canvas sınırları
    x = Math.max(AVATAR_RADIUS, Math.min(CANVAS_WIDTH - AVATAR_RADIUS, x));
    y = Math.max(AVATAR_RADIUS, Math.min(CANVAS_HEIGHT - AVATAR_RADIUS, y));

    // Collision yoksa direkt döndür
    if (!hasCollision(x, y)) return { x, y };

    // Collision varsa spiral olarak en yakın boş noktayı bul
    for (let r = MIN_DISTANCE; r < CANVAS_WIDTH; r += 10) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const testX = x + Math.cos(angle) * r;
        const testY = y + Math.sin(angle) * r;
        
        // Canvas sınırları
        if (testX < AVATAR_RADIUS || testX > CANVAS_WIDTH - AVATAR_RADIUS) continue;
        if (testY < AVATAR_RADIUS || testY > CANVAS_HEIGHT - AVATAR_RADIUS) continue;
        
        if (!hasCollision(testX, testY)) {
          return { 
            x: snapToGrid ? Math.round(testX / gridSize) * gridSize : testX, 
            y: snapToGrid ? Math.round(testY / gridSize) * gridSize : testY 
          };
        }
      }
    }

    return { x, y };
  }, [layout, snapToGrid, gridSize]);

  // ──────────────────────────────────────────────────
  // DRAG HANDLERS — requestAnimationFrame ile senkronize
  // ──────────────────────────────────────────────────
  const handleDragStart = useCallback((userId, e) => {
    if (userId === localUserId) return; // Local user taşınamaz
    e.preventDefault?.();

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const currentPos = layout[userId] || { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

    const mouseX = (e.clientX - canvasRect.left) / scale;
    const mouseY = (e.clientY - canvasRect.top) / scale;

    setDraggingUser(userId);
    setDragOffset({
      x: mouseX - currentPos.x,
      y: mouseY - currentPos.y
    });
    setTempPosition(currentPos);
  }, [localUserId, layout, scale]);

  useEffect(() => {
    if (!draggingUser) return;

    const handleMouseMove = (e) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const mouseX = (e.clientX - canvasRect.left) / scale;
      const mouseY = (e.clientY - canvasRect.top) / scale;

      const targetX = mouseX - dragOffset.x;
      const targetY = mouseY - dragOffset.y;

      const freePos = findNearestFreePosition(targetX, targetY, draggingUser);
      
      setTempPosition(freePos);

      // Real-time audio update (rafRef ile debounce)
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPosition(channelId, draggingUser, freePos.x, freePos.y);
        onUpdatePosition?.(draggingUser, freePos.x, freePos.y);
      });
    };

    const handleMouseUp = () => {
      if (tempPosition) {
        setPosition(channelId, draggingUser, tempPosition.x, tempPosition.y);
        onUpdatePosition?.(draggingUser, tempPosition.x, tempPosition.y);
      }
      setDraggingUser(null);
      setTempPosition(null);
    };

    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    };

    const handleTouchEnd = () => handleMouseUp();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draggingUser, dragOffset, tempPosition, scale, channelId, setPosition, onUpdatePosition, findNearestFreePosition]);

  // ──────────────────────────────────────────────────
  // Audio değerlerini hesapla (her avatar için)
  // ──────────────────────────────────────────────────
  const audioValuesMap = useMemo(() => {
    const map = {};
    participantData.forEach(p => {
      if (p.isLocal) return;
      map[p.userId] = calculateAudioFromPosition(p.x, p.y, CANVAS_WIDTH, CANVAS_HEIGHT);
    });
    return map;
  }, [participantData]);

  // ──────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full h-full pb-1">
      {/* ═══ KONTROL BAR (TITLE BAR) ═══ */}
      <div 
        className="h-10 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing shrink-0 z-[60] select-none"
        onPointerDown={(e) => dragControls?.start(e)}
      >
        <div className="flex items-center gap-1.5 pointer-events-none">
          <Radar size={14} className="text-indigo-400" />
          <span className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest">Spatial Audio</span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
          <PresetPanel channelId={channelId} participantCount={participants.length} localUserId={localUserId} participantIds={identities} />

          <button
            onClick={toggleSnapToGrid}
            className={`p-1 hover:bg-white/10 rounded transition-colors ${
              snapToGrid ? 'text-indigo-400' : 'text-white/40 hover:text-white'
            }`}
            title={snapToGrid ? 'Snap to Grid: Açık' : 'Snap to Grid: Kapalı'}
          >
            <Grid3X3 size={13} strokeWidth={2.5} />
          </button>

          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
            title={isExpanded ? 'Küçült' : 'Büyüt'}
          >
            {isExpanded ? <Minimize2 size={13} strokeWidth={2.5} /> : <Maximize2 size={13} strokeWidth={2.5} />}
          </button>

          <button
            onClick={onClose}
            className="p-1 hover:bg-red-500/20 rounded text-white/40 hover:text-red-400 transition-colors ml-1"
            title="Kapat"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 bg-transparent flex-1 relative overflow-hidden">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0c] shadow-inner shrink-0"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 70%),
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: `100% 100%, ${snapToGrid ? gridSize * scale : 40 * scale}px ${snapToGrid ? gridSize * scale : 40 * scale}px, ${snapToGrid ? gridSize * scale : 40 * scale}px ${snapToGrid ? gridSize * scale : 40 * scale}px`,
          }}
        />

        {/* Yön: üst = senin ÖNÜN. Kim yukarıdaysa karşında, aşağıdaysa arkanda duyulur. */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold tracking-[0.2em] text-indigo-300/50 pointer-events-none select-none">
          ▲ ÖN
        </div>

        {/* Center crosshair */}
        <div className="absolute pointer-events-none" style={{
          left: canvasWidth / 2 - 12,
          top: canvasHeight / 2 - 12,
          width: 24,
          height: 24,
        }}>
          <div className="absolute top-1/2 left-0 w-full h-px bg-white/10" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-white/10" />
        </div>

        {/* Distance rings */}
        {[0.25, 0.5, 0.75].map(r => (
          <div
            key={r}
            className="absolute rounded-full border border-white/[0.04] pointer-events-none"
            style={{
              left: canvasWidth / 2 - (canvasWidth * r),
              top: canvasHeight / 2 - (canvasHeight * r),
              width: canvasWidth * r * 2,
              height: canvasHeight * r * 2,
            }}
          />
        ))}

        {/* Avatars */}
        <div className="absolute inset-0" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
          {participantData.map(p => {
            const pos = draggingUser === p.userId && tempPosition
              ? tempPosition
              : { x: p.x, y: p.y };

            return (
              <SpatialAvatar
                key={p.userId}
                userId={p.userId}
                displayName={p.displayName}
                photoURL={p.photoURL}
                profileColor={p.profileColor}
                x={pos.x}
                y={pos.y}
                isLocal={p.isLocal}
                isSpeaking={p.isSpeaking}
                isDragging={draggingUser === p.userId}
                audioValues={audioValuesMap[p.userId] || null}
                onDragStart={handleDragStart}
              />
            );
          })}
        </div>

        {/* Drag instruction overlay (ilk kullanım) */}
        {participantData.length <= 1 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center px-4">
              <p className="text-white/20 text-[11px] font-medium">
                Diğer kullanıcılar katıldığında avatarları sürükleyin
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 text-[9px] text-white/30 shrink-0">
        <span>{participantData.length} kullanıcı</span>
        <span>{snapToGrid ? `Grid: ${gridSize}px` : 'Serbest mod'}</span>
      </div>
      </div>
    </div>
  );
}
