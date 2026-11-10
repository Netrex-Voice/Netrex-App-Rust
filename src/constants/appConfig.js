export const CHANNEL_NAME_MIN_LENGTH = 3;
export const CHANNEL_NAME_MAX_LENGTH = 30;
export const ROOM_NAME_MIN_LENGTH = 3;
export const ROOM_NAME_MAX_LENGTH = 50;
export const SERVER_NAME_MIN_LENGTH = 3;
export const SERVER_NAME_MAX_LENGTH = 30;

export const MAX_TEXT_CHANNELS_PER_USER = 3;
export const MAX_SERVERS_PER_USER = 10;

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_COOLDOWN_MS = 1000; // 1 second - sadece spam koruması için
export const MESSAGE_SPAM_THRESHOLD_MS = 500; // 0.5 saniye içinde mesaj gönderilirse spam sayılır
export const MESSAGE_SPAM_COOLDOWN_MS = 3000; // Spam tespit edilirse 3 saniye cooldown
export const CHANNEL_CREATION_COOLDOWN_MS = 10_000; // 10 seconds

export const MESSAGE_PAGE_SIZE = 50;
export const MAX_STORED_MESSAGES = 500;
export const MESSAGE_SEQUENCE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export const DEFAULT_ROLE_NAME = "@everyone";
export const DEFAULT_ROLE_COLOR = "#99aab5";
