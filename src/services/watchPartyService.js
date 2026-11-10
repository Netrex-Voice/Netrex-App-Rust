// src/services/watchPartyService.js
import {
  doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, deleteField,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { VOTE_UP, VOTE_DOWN, VOTE_NONE } from '@/src/constants/watchPartyConstants';
import { toast } from 'sonner';

// ─── Referans ───
const getRef = (serverId, channelId) =>
  doc(db, 'servers', serverId, 'channels', channelId, 'watchParty', 'session');

const generateTrackId = () =>
  `track_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

// ═══════════════════════════════════════
// YAŞAM DÖNGÜSÜ
// ═══════════════════════════════════════

export async function startWatchParty(serverId, channelId, hostId) {
  await setDoc(getRef(serverId, channelId), {
    isActive: true,
    hostId,
    coHosts: [],
    coHostPermissions: {},
    currentTrack: null,
    playbackState: {
      isPlaying: false,
      startedAt: null,
      seekPosition: 0,
      lastUpdated: Date.now(),
    },
    playlist: [],
    votes: {},
    createdAt: serverTimestamp(),
  }).then(() => {
    toast.success("Watch Party Başlatıldı!");
  }).catch((err) => {
    toast.error("Başlatılamadı: " + err.message);
  });
}

export async function endWatchParty(serverId, channelId) {
  await deleteDoc(getRef(serverId, channelId)).then(() => {
    toast.success("Watch Party Kapatıldı");
  }).catch((err) => {
    toast.error("Kapatılamadı: " + err.message);
  });
}

// ═══════════════════════════════════════
// CO-HOST YÖNETİMİ
// ═══════════════════════════════════════

export async function addCoHost(serverId, channelId, userId) {
  const ref = getRef(serverId, channelId);
  // arrayUnion ile ekle
  const { arrayUnion } = await import('firebase/firestore');
  await updateDoc(ref, {
    coHosts: arrayUnion(userId),
    [`coHostPermissions.${userId}`]: {
      // Varsayılan: Hiçbir yetki açık değil, host sonradan seçer
      canManageTracks: false,
      canControlPlayback: false,
    },
  });
}

export async function removeCoHost(serverId, channelId, userId) {
  const ref = getRef(serverId, channelId);
  const { arrayRemove } = await import('firebase/firestore');
  await updateDoc(ref, {
    coHosts: arrayRemove(userId),
    [`coHostPermissions.${userId}`]: deleteField(),
  });
}

export async function transferHost(serverId, channelId, newHostId) {
  await updateDoc(getRef(serverId, channelId), { hostId: newHostId });
}

export async function updateCoHostPermissions(serverId, channelId, userId, permissions) {
  await updateDoc(getRef(serverId, channelId), {
    [`coHostPermissions.${userId}`]: permissions,
  });
}

// ═══════════════════════════════════════
// PLAYLIST YÖNETİMİ
// ═══════════════════════════════════════

export async function addTrackToPlaylist(serverId, channelId, trackData) {
  const ref = getRef(serverId, channelId);
  const track = {
    ...trackData,
    id: generateTrackId(),
    addedAt: Date.now(),
  };

  const { arrayUnion } = await import('firebase/firestore');
  await updateDoc(ref, {
    playlist: arrayUnion(track),
  });

  return track;
}

// Birden çok parçayı TEK yazmada ekler (çalma listesi içe aktarma). arrayUnion verilen sırayla ekler;
// böylece liste YouTube'daki sırasıyla kalır. Eklenen (id'li) parçaları döndürür.
export async function addTracksToPlaylist(serverId, channelId, tracks) {
  if (!tracks?.length) return [];
  const base = Date.now();
  const built = tracks.map((t, i) => ({
    ...t,
    id: `track_${base}_${i}_${Math.random().toString(36).slice(2, 8)}`,
    addedAt: base + i,
  }));
  const { arrayUnion } = await import('firebase/firestore');
  await updateDoc(getRef(serverId, channelId), { playlist: arrayUnion(...built) });
  return built;
}

export async function removeTrackFromPlaylist(serverId, channelId, track) {
  const ref = getRef(serverId, channelId);
  const { arrayRemove } = await import('firebase/firestore');

  // Parçanın oylarını da temizle
  await updateDoc(ref, {
    playlist: arrayRemove(track),
    [`votes.${track.id}`]: deleteField(),
  });
}

export async function reorderPlaylist(serverId, channelId, newPlaylist) {
  await updateDoc(getRef(serverId, channelId), { playlist: newPlaylist });
}

// ═══════════════════════════════════════
// PLAYBACK KONTROLÜ (Firebase'e yazılır, DataChannel'dan da gider)
// ═══════════════════════════════════════

export async function setCurrentTrackInDb(serverId, channelId, track) {
  await updateDoc(getRef(serverId, channelId), {
    currentTrack: track,
    playbackState: {
      isPlaying: true,
      startedAt: Date.now(),
      seekPosition: 0,
      lastUpdated: Date.now(),
    },
  });
}

export async function updatePlaybackInDb(serverId, channelId, playbackState) {
  await updateDoc(getRef(serverId, channelId), {
    'playbackState': playbackState,
  });
}

export async function clearCurrentTrackInDb(serverId, channelId) {
  await updateDoc(getRef(serverId, channelId), {
    currentTrack: null,
    playbackState: {
      isPlaying: false,
      startedAt: null,
      seekPosition: 0,
      lastUpdated: Date.now(),
    },
  });
}

// ═══════════════════════════════════════
// OY SİSTEMİ
// ═══════════════════════════════════════

export async function voteTrack(serverId, channelId, trackId, userId, voteValue) {
  const ref = getRef(serverId, channelId);

  if (voteValue === VOTE_NONE) {
    // Oyu kaldır
    await updateDoc(ref, {
      [`votes.${trackId}.${userId}`]: deleteField(),
    });
  } else {
    // Oy ver (1 veya -1)
    await updateDoc(ref, {
      [`votes.${trackId}.${userId}`]: voteValue,
    });
  }
}

// ═══════════════════════════════════════
// REALTIME DİNLEYİCİ
// ═══════════════════════════════════════

export function subscribeToWatchParty(serverId, channelId, callback) {
  const ref = getRef(serverId, channelId);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback({ ...snap.data() });
    } else {
      callback(null);
    }
  });
}
