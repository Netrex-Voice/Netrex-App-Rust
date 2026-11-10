import { useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, ChevronRight, Monitor, ShieldAlert, X } from "lucide-react";

/**
 * ✅ AccountActions - Optimized account actions
 * Handles logout and admin DevTools
 */
export default function AccountActions({ user, logout, onClose }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Admin check
  const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";
  const isAdmin = user && ADMIN_UID && user.uid === ADMIN_UID;

  const handleOpenDevTools = async () => {
    if (window.netrex && isAdmin) {
      try {
        const result = await window.netrex.openDevTools(user?.uid);
        if (!result.success) {
          console.error("DevTools açılamadı:", result.error);
        }
      } catch (error) {
        console.error("DevTools açma hatası:", error);
      }
    }
  };

  const confirmLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <>
      {/* Admin DevTools */}
      {isAdmin && window.netrex && (
        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
          
          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
            <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
              <ShieldAlert size={14} className="text-red-400" />
            </div>
            Admin Araçları
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/10 text-red-400 border border-red-500/30">
              ADMIN
            </span>
          </h4>
          <div className="relative z-10">
            <button
              onClick={handleOpenDevTools}
              onMouseDown={(e) => e.preventDefault()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] focus:outline-none"
            >
              <Monitor size={16} />
              Developer Tools'u Aç
            </button>
            <p className="text-xs text-[#949ba4] mt-3 text-center">
              Build edilmiş uygulamada console'u açmak için
            </p>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
            <LogOut size={14} className="text-red-400" />
          </div>
          Hesap İşlemleri
        </h4>
        
        <button
          onClick={() => setShowLogoutModal(true)}
          onMouseDown={(e) => e.preventDefault()}
          className="relative z-10 flex items-center justify-between p-4 rounded-xl bg-[#1e1f22] border-2 border-red-500/30 hover:border-red-500 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-600/10 group transition-all duration-300 cursor-pointer text-left w-full overflow-hidden focus:outline-none"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <LogOut size={18} className="text-red-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white group-hover:text-red-300 transition-colors">
                Çıkış Yap
              </span>
              <span className="text-xs text-[#949ba4] group-hover:text-[#b5bac1] transition-colors">
                Oturumunu kapat ve giriş ekranına dön.
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center relative z-10 group-hover:bg-red-500/20 transition-colors">
            <ChevronRight size={18} className="text-red-400" />
          </div>
        </button>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setShowLogoutModal(false)}></div>
          <div className="glass-strong bg-[#1e1f22] border border-red-500/20 rounded-2xl w-full max-w-md p-0 relative z-10 animate-nds-scale-in shadow-2xl overflow-hidden">
            <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <LogOut size={24} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Çıkış Yap</h3>
                <p className="text-[#949ba4] leading-relaxed">
                  Hesabından çıkış yapmak istediğine emin misin? Tekrar giriş yapana kadar bildirim almayacaksın.
                </p>
            </div>
            <div className="p-4 bg-white/5 flex justify-end gap-3 border-t border-white/5">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2.5 rounded-xl text-[#dbdee1] hover:bg-white/5 transition-colors font-medium text-sm"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmLogout}
                className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white transition-all font-medium text-sm shadow-lg shadow-red-500/20 flex items-center gap-2"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
