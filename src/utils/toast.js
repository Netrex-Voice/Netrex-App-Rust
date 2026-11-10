import { useToastStore } from "@/src/store/toastStore";

// Son gösterilen toast mesajlarını takip et (mesaj -> zaman)
const lastToastMap = new Map();
const TOAST_COOLDOWN_MS = 2000; 

/**
 * Aynı mesajı kısa süre içinde tekrar göstermeyen toast wrapper
 */
export function toastOnce(message, type = "success", options = {}) {
  const now = Date.now();
  const lastTime = lastToastMap.get(message);

  if (lastTime && now - lastTime < TOAST_COOLDOWN_MS) {
    return;
  }

  lastToastMap.set(message, now);
  
  const titleMap = {
     success: "Harika!",
     error: "Bir Sorun Var",
     warning: "Dikkat",
     info: "Sistem Mesajı"
  };

  useToastStore.getState().addToast({
    title: options.title || titleMap[type],
    message,
    type,
    duration: options.duration || 5000,
    ...options
  });
}

/**
 * Chat mesajları için özel toast bildirimi
 */
export function chatToast({ username, message, channelName, avatarColor, onClick }) {
  const now = Date.now();
  const toastKey = `chat-${username}-${message?.slice(0, 20)}`;
  const lastTime = lastToastMap.get(toastKey);

  if (lastTime && now - lastTime < TOAST_COOLDOWN_MS) {
    return;
  }
  lastToastMap.set(toastKey, now);

  useToastStore.getState().addToast({
    type: 'chat',
    username,
    message,
    channelName: channelName || 'genel',
    avatarColor,
    onClick,
    duration: 6000
  });
}

/**
 * Sistem bildirimi için toast
 */
export function systemToast({ title, message, type = "info", onClick }) {
  const now = Date.now();
  const toastKey = `system-${title}-${message?.slice(0, 20)}`;
  const lastTime = lastToastMap.get(toastKey);

  if (lastTime && now - lastTime < TOAST_COOLDOWN_MS) {
    return;
  }
  lastToastMap.set(toastKey, now);

  // Type: 'join', 'leave', 'stream', 'info'
  useToastStore.getState().addToast({
    type,
    title,
    message,
    onClick,
    duration: 5000
  });
}

// Standart toast fonksiyonu & objesi - Geriye uyumluluk ve Sonner API uyumluluğu için
function baseToast(message, opt = {}) {
  const msgStr = typeof message === "string" ? message : (typeof message === "function" ? "Yeni Bildirim" : String(message || ""));
  return toast.info(msgStr, opt);
}

export const toast = Object.assign(baseToast, {
  success: (m, opt = {}) => {
    if (opt.id) {
      useToastStore.getState().updateToast(opt.id, { 
        message: m, 
        type: 'success', 
        title: opt.title || "Harika!",
        duration: opt.duration || 5000 
      });
      return opt.id;
    }
    return useToastStore.getState().addToast({
      title: opt.title || "Harika!",
      message: m,
      type: 'success',
      duration: opt.duration || 5000,
      ...opt
    });
  },
  error: (m, opt = {}) => {
    if (opt.id) {
       useToastStore.getState().updateToast(opt.id, { 
         message: m, 
         type: 'error', 
         title: opt.title || "Bir Sorun Var",
         duration: opt.duration || 5000 
       });
       return opt.id;
    }
    return useToastStore.getState().addToast({
      title: opt.title || "Bir Sorun Var",
      message: m,
      type: 'error',
      duration: opt.duration || 5000,
      ...opt
    });
  },
  info: (m, opt = {}) => {
    if (opt.id) {
       useToastStore.getState().updateToast(opt.id, { 
         message: m, 
         type: 'info', 
         title: opt.title || "Sistem Mesajı",
         duration: opt.duration || 5000 
       });
       return opt.id;
    }
    return useToastStore.getState().addToast({
      title: opt.title || "Sistem Mesajı",
      message: m,
      type: 'info',
      duration: opt.duration || 5000,
      ...opt
    });
  },
  warning: (m, opt = {}) => {
    if (opt.id) {
       useToastStore.getState().updateToast(opt.id, { 
         message: m, 
         type: 'warning', 
         title: opt.title || "Dikkat",
         duration: opt.duration || 5000 
       });
       return opt.id;
    }
    return useToastStore.getState().addToast({
      title: opt.title || "Dikkat",
      message: m,
      type: 'warning',
      duration: opt.duration || 5000,
      ...opt
    });
  },
  loading: (m, opt = {}) => {
    return useToastStore.getState().addToast({
      title: opt.title || "İşlem Yapılıyor",
      message: m,
      type: 'info',
      duration: opt.duration || 30000,
      ...opt
    });
  },
  dismiss: (id) => {
    useToastStore.getState().dismiss(id);
  }
});
