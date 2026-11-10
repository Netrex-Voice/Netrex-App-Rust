import { useState, useCallback } from "react";
import { User, Check, Pipette } from "lucide-react";
import { toast } from "@/src/utils/toast";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { STATUS_COLORS } from "../constants";

/**
 * ✅ ProfileInfoEditor - Optimized bio and status editor
 * Handles custom status with color picker and bio with character limits
 */
export default function ProfileInfoEditor({ user, initialBio = "", initialStatus = "", initialStatusColor = "#949ba4" }) {
  const [bio, setBio] = useState(initialBio);
  const [customStatus, setCustomStatus] = useState(initialStatus);
  const [customStatusColor, setCustomStatusColor] = useState(initialStatusColor);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ OPTIMIZATION: Memoized handlers
  const handleStatusChange = useCallback((e) => {
    const cleaned = e.target.value
      .replace(/[\r\n]/g, '')
      .replace(/\s+/g, ' ');
    setCustomStatus(cleaned.slice(0, 50));
  }, []);

  const handleBioChange = useCallback((e) => {
    let value = e.target.value;
    
    value = value.replace(/\n{3,}/g, '\n\n');
    
    const lines = value.split('\n');
    if (lines.length > 3) {
      value = lines.slice(0, 3).join('\n');
    }
    
    value = value.split('\n').map(line => line.replace(/\s+/g, ' ')).join('\n');
    
    setBio(value.slice(0, 200));
  }, []);

  const handleBioKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      const currentLines = bio.split('\n').length;
      if (currentLines >= 3) {
        e.preventDefault();
      }
    }
  }, [bio]);

  const saveProfile = async () => {
    if (!user?.uid) {
      toast.error("Kullanıcı oturumu bulunamadı");
      return;
    }
    
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      const updateData = {
        bio: bio.trim(),
        customStatus: customStatus.trim(),
        customStatusColor: customStatusColor,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(doc(db, "users", user.uid), updateData);
      toast.success("Profil güncellendi!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Profil güncellenemedi: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <User size={14} className="text-indigo-400" />
        </div>
        Profil Bilgileri
      </h4>
      
      <div className="relative z-10 space-y-4">
        {/* Custom Status */}
        <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-[#949ba4] uppercase block">
              DURUM
            </label>
            
            {/* Color Picker */}
            <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-lg">
              {STATUS_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setCustomStatusColor(color)}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                    customStatusColor === color 
                      ? 'scale-125 ring-2 ring-white/50 shadow-[0_0_8px_rgba(255,255,255,0.3)]' 
                      : 'hover:scale-110 opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              
              <div className="w-px h-3.5 bg-white/10 mx-0.5"></div>
              <label className="relative cursor-pointer group" title="Özel Renk Seç">
                <input 
                  type="color" 
                  value={customStatusColor}
                  onChange={(e) => setCustomStatusColor(e.target.value)}
                  className="absolute opacity-0 inset-0 w-full h-full cursor-pointer z-10"
                />
                <div 
                  className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center transition-all duration-300 ${
                    !STATUS_COLORS.includes(customStatusColor) 
                      ? 'scale-125 ring-2 ring-white/50 shadow-[0_0_8px_rgba(255,255,255,0.3)]' 
                      : 'hover:scale-110 opacity-60 hover:opacity-100 bg-gradient-to-br from-white/10 to-transparent'
                  }`}
                  style={{ 
                    backgroundColor: !STATUS_COLORS.includes(customStatusColor) ? customStatusColor : undefined 
                  }}
                >
                  {!STATUS_COLORS.includes(customStatusColor) ? null : <Pipette size={8} className="text-white" />}
                </div>
              </label>
            </div>
          </div>

          <input
            type="text"
            value={customStatus}
            onChange={handleStatusChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Ne yapıyorsun?"
            maxLength={50}
            style={{ color: customStatusColor }}
            className="w-full bg-[#111214] border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-[#5c5e66] focus:outline-none focus:border-indigo-500/50 transition-colors font-medium"
          />
          <span className="text-[10px] text-[#5c5e66] mt-1 block text-right">
            {customStatus.length}/50
          </span>
        </div>

        {/* Bio */}
        <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
          <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-2 block">
            Hakkımda
          </label>
          <textarea
            value={bio}
            onChange={handleBioChange}
            onKeyDown={handleBioKeyDown}
            placeholder="Kendinden biraz bahset..."
            maxLength={200}
            rows={3}
            className="w-full bg-[#111214] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-[#5c5e66] focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
          />
          <span className="text-[10px] text-[#5c5e66] mt-1 block text-right">
            {bio.length}/200
          </span>
        </div>

        {/* Save Button */}
        <button
          onClick={saveProfile}
          onMouseDown={(e) => e.preventDefault()}
          disabled={isSaving}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
            isSaving 
              ? "bg-indigo-500/50 text-white/70 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          }`}
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Check size={16} />
              Profili Kaydet
            </>
          )}
        </button>
      </div>
    </div>
  );
}
