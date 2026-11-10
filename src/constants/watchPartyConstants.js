// src/constants/watchPartyConstants.js

export const WP_ROLES = {
  HOST:      'host',
  ADMIN:     'admin',
  MODERATOR: 'moderator',
  CO_HOST:   'co_host',
  MEMBER:    'member',
};

export const VOTE_UP   =  1;
export const VOTE_DOWN = -1;
export const VOTE_NONE =  0;

// DataChannel mesaj tipleri (LiveKit üzerinden senkron)
export const WP_MSG = {
  PLAY:        'wp_play',
  PAUSE:       'wp_pause',
  SEEK:        'wp_seek',
  SKIP:        'wp_skip',
  SYNC_REQUEST: 'wp_sync_request',
  SYNC_RESPONSE: 'wp_sync_response',
};

// Drift düzeltme eşiği (saniye)
export const DRIFT_THRESHOLD_SEC = 2;
export const DRIFT_CHECK_INTERVAL_MS = 5000;