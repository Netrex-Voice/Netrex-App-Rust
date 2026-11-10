"use client";

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuthStore } from '@/src/store/authStore';
import { useServerStore } from '@/src/store/serverStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { registerCleanupTask } from '@/src/utils/cleanup';
import { getRtdbPresence, startMyConnectionPresence, markMyConnectionOffline } from '@/src/lib/rtdbPresence';

// Batch update window: collect all status changes within this period
// ✅ OPTIMIZATION #2: Increased from 2s to 3s for better batching
const PRESENCE_BATCH_DELAY = 3000;

// Heartbeat intervals (dynamic based on voice chat state)
// ✅ OPTIMIZATION #9: Different intervals for voice chat
const HEARTBEAT_INTERVAL_VOICE = 2 * 60 * 1000; // 2 minutes in voice
const HEARTBEAT_INTERVAL_IDLE = 5 * 60 * 1000;  // 5 minutes otherwise

// How long before a user is considered "stale" (offline)
// Boştaki kullanıcının heartbeat aralığından (5 dk) UZUN olmalı. Eskiden eşik de 5 dk'ydı:
// boştaki biri bir sonraki sinyalinden hemen önce kısa süre "çevrimdışı" görünüp geri dönüyordu.
// 8 dk = bir heartbeat + bir kaçırılan sinyal toleransı.
export const PRESENCE_STALE_THRESHOLD = 8 * 60 * 1000; // 8 minutes

export function usePresence() {
  const { user } = useAuthStore();
  const { currentServer } = useServerStore();
  const userStatus = useSettingsStore(state => state.userStatus);
  const isInVoiceRoom = useSettingsStore(state => state.isInVoiceRoom);
  const quickStatus = useSettingsStore(state => state.quickStatus);
  
  // ✅ OPTIMIZATION #1: Ref-based state (eliminate dependency hell)
  const userRef = useRef(user);
  const userStatusRef = useRef(userStatus);
  const currentServerRef = useRef(currentServer);
  const isInVoiceRoomRef = useRef(isInVoiceRoom);
  const quickStatusRef = useRef(quickStatus);
  
  // ✅ OPTIMIZATION #2: Batch update state
  const pendingUpdateRef = useRef(null);
  const batchTimeoutRef = useRef(null);
  
  // Other refs
  const cleanupRegisteredRef = useRef(false);
  const heartbeatIntervalRef = useRef(null);
  
  // ✅ OPTIMIZATION #1: Update refs when values change
  useEffect(() => {
    userRef.current = user;
    userStatusRef.current = userStatus;
    currentServerRef.current = currentServer;
    isInVoiceRoomRef.current = isInVoiceRoom;
    quickStatusRef.current = quickStatus;
  }, [user, userStatus, currentServer, isInVoiceRoom, quickStatus]);

  // ✅ OPTIMIZATION #2: Batch-optimized presence update
  const updatePresence = useCallback(async (status) => {
    if (!userRef.current?.uid) return;
    
    // If user manually set status to invisible, don't override
    if (userStatusRef.current === 'invisible') {
      status = 'offline';
    }
    
    // Store pending update
    pendingUpdateRef.current = status;
    
    // Clear previous batch timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    // Batch: wait for more updates before writing
    batchTimeoutRef.current = setTimeout(async () => {
      const finalStatus = pendingUpdateRef.current;
      if (!userRef.current?.uid) return;
      
      try {
        const updateData = {
          presence: finalStatus,
          lastSeen: serverTimestamp(),
          quickStatus: quickStatusRef.current || null
        };

        // Clear game activity when going offline
        if (finalStatus === 'offline' || finalStatus === 'invisible') {
          updateData.gameActivity = null;
        }

        await updateDoc(doc(db, 'users', userRef.current.uid), updateData);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`👤 Presence updated (batched): ${finalStatus}`);
        }
      } catch (error) {
        console.error('Failed to update presence:', error);
      }
    }, PRESENCE_BATCH_DELAY);
  }, []); // ✅ No dependencies - uses refs

  // ✅ OPTIMIZATION #3: Ref-based heartbeat (no store access)
  const sendHeartbeat = useCallback(async () => {
    const currentUser = userRef.current;
    const currentStatus = userStatusRef.current;
    
    // Don't send heartbeat if user is offline or invisible
    if (!currentUser?.uid || currentStatus === 'offline' || currentStatus === 'invisible') {
      return;
    }
    
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        lastSeen: serverTimestamp(),
        presence: currentStatus || 'online'
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('💓 Heartbeat sent');
      }
    } catch (error) {
      // Silently ignore heartbeat errors
    }
  }, []); // ✅ No dependencies - uses refs

  // ✅ OPTIMIZATION #4: Cleaned up setOfflineOnAllServers
  const setOfflineOnAllServers = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.uid) return;
    
    // Gerçek zamanlı bağlantı bilgisini de hemen kopuk işaretle (diğerleri anında görsün)
    markMyConnectionOffline(currentUser.uid);

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        presence: 'offline',
        lastSeen: serverTimestamp(),
        gameActivity: null 
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('👤 Presence set to offline');
      }
    } catch (error) {
      // Silently swallow error (beforeunload is not guaranteed anyway)
    }
  }, []); // ✅ No dependencies - uses refs

  // Handle userStatus or quickStatus changes from settingsStore
  useEffect(() => {
    if (user?.uid) {
      updatePresence(userStatus);
    }
  }, [userStatus, quickStatus, user?.uid, updatePresence]);

  // ✅ OPTIMIZATION #9: Dynamic heartbeat interval based on voice chat
  useEffect(() => {
    if (!user?.uid) return;
    
    let startupDelay = null;

    const updateHeartbeatInterval = (sendImmediate = true) => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      const interval = isInVoiceRoomRef.current 
        ? HEARTBEAT_INTERVAL_VOICE 
        : HEARTBEAT_INTERVAL_IDLE;
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, interval);
      // ✅ FIX: Açılışta anında Firestore write yapma - geciktir
      if (sendImmediate) {
        sendHeartbeat();
      }
      if (process.env.NODE_ENV === 'development') {
        console.log(`💓 Heartbeat interval: ${interval / 1000}s (voice: ${isInVoiceRoomRef.current})`);
      }
    };

    // ✅ İlk heartbeat'i 30sn geciktir - updatePresence zaten t=3'te yazıyor
    // sendImmediate=false: Açılışta duplicate Firestore write yapma
    startupDelay = setTimeout(() => {
      updateHeartbeatInterval(false);
    }, 30000);

    const unsubscribe = useSettingsStore.subscribe(
      (state) => state.isInVoiceRoom,
      (newValue, prevValue) => {
        if (newValue !== prevValue) {
          isInVoiceRoomRef.current = newValue;
          updateHeartbeatInterval(true);
        }
      }
    );
    
    return () => {
      if (startupDelay) clearTimeout(startupDelay);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      unsubscribe();
    };
  }, [user?.uid, sendHeartbeat]);

  // 🟢 Gerçek zamanlı bağlantı durumu: bağlanınca "bağlı" yazar, koparsa (çökme, internet kesilmesi dahil)
  // sunucu kendisi "kopuk" yazar. Kurallar izin vermezse sessizce atlanır, heartbeat yöntemi sürer.
  useEffect(() => {
    if (!user?.uid) return;
    return startMyConnectionPresence(user.uid);
  }, [user?.uid]);

  // ✅ OPTIMIZATION #6: Proper cleanup registration (once only)
  useEffect(() => {
    if (!user?.uid || cleanupRegisteredRef.current) return;
    
    cleanupRegisteredRef.current = true;
    
    const unregister = registerCleanupTask(async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log("👤 Cleanup task: Setting offline status before quit...");
      }
      await setOfflineOnAllServers();
    });
    
    return () => {
      cleanupRegisteredRef.current = false;
      unregister();
    };
  }, [user?.uid]); // ✅ setOfflineOnAllServers removed from deps

  // ✅ OPTIMIZATION #5: navigator.sendBeacon for reliable beforeunload
  useEffect(() => {
    if (!user?.uid) return;

    const handleBeforeUnload = () => {
      // Clear any pending batch updates
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('👤 beforeunload: setting offline via cleanup...');
      }
      
      // Trigger cleanup immediately (non-blocking)
      // The registerCleanupTask will handle the actual Firebase write
      setOfflineOnAllServers();
      
      // Note: sendBeacon doesn't work with Firestore directly
      // We rely on the cleanup mechanism + Electron IPC for guaranteed delivery
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.uid]); // ✅ setOfflineOnAllServers removed from deps

  return {
    updatePresence,
    setOffline: () => updatePresence('offline'),
    setOnline: () => updatePresence('online'),
    setIdle: () => updatePresence('idle'),
    setOfflineOnAllServers,
    sendHeartbeat // Expose for manual heartbeat if needed
  };
}

/**
 * ✅ OPTIMIZATION #7: Optimized date parsing helper
 * Helper function to check if a user's presence is stale
 * Use this in components that display user presence
 * 
 * @param {Object} member - Member object with presence and lastSeen fields
 * @param {number} now - Optional current timestamp (for testing/memoization)
 * @returns {string} - Effective presence status ('online', 'idle', or 'offline')
 */
export function getEffectivePresence(member, now = Date.now()) {
  if (!member?.presence) return 'offline';
  
  const { presence, lastSeen } = member;
  
  // If already offline, return offline
  if (presence === 'offline') return 'offline';

  // 🟢 Canlı bağlantı bilgisi varsa (Realtime Database) heartbeat'e bakmadan ona güven:
  // bağlantı koptuysa anında çevrimdışı, bağlıysa kullanıcının seçtiği durum.
  const uid = member.uid || member.id || member.userId;
  const live = uid ? getRtdbPresence(uid) : undefined;
  if (live) return live.connected ? presence : 'offline';
  
  // Check if lastSeen exists
  if (!lastSeen) return 'offline';
  
  // ✅ OPTIMIZATION #7: Single optimized date parsing
  // Support multiple date formats (Firestore Timestamp, Date, number)
  const lastSeenTime = 
    lastSeen?.toMillis?.() ||                    // Firestore Timestamp
    lastSeen?.toDate?.().getTime() ||            // Firestore Timestamp (legacy)
    (typeof lastSeen === 'number' ? lastSeen : new Date(lastSeen).getTime()); // Date or string
  
  const timeSinceLastSeen = now - lastSeenTime;
  
  // If lastSeen is older than threshold, user is effectively offline
  if (timeSinceLastSeen > PRESENCE_STALE_THRESHOLD) {
    return 'offline';
  }
  
  // Return actual presence if not stale
  return presence;
}

export default usePresence;
