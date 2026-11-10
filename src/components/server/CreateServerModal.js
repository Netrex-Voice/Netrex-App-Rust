import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Smile, Upload, Image, Loader2 } from "lucide-react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import EmojiPicker from 'emoji-picker-react';
import { uploadServerIconToCloudinary } from "@/src/utils/imageUpload";
import { toast } from "sonner";

export default function CreateServerModal({ isOpen, onClose, onJoinClick }) {
  const [serverName, setServerName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [selectedImage, setSelectedImage] = useState(null); // File object
  const [imagePreview, setImagePreview] = useState(null); // Data URL for preview
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [iconType, setIconType] = useState("emoji"); // "emoji" or "image"
  const fileInputRef = useRef(null);
  // Seçicisiz abonelik, modal kapalıyken bile sunucu deposundaki her değişiklikte render ediyordu
  const createServer = useServerStore((s) => s.createServer);
  const user = useAuthStore((s) => s.user);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen geçerli bir resim dosyası seçin.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resim boyutu 5MB'dan küçük olmalı.");
      return;
    }

    setSelectedImage(file);
    setSelectedEmoji(""); // Clear emoji if image selected
    setIconType("image");

    // Create preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;

    setIsLoading(true);
    
    let iconUrl = null;

    // Upload image to Cloudinary if selected
    if (iconType === "image" && selectedImage) {
      try {
        setIsUploading(true);
        iconUrl = await uploadServerIconToCloudinary(selectedImage);
        setIsUploading(false);
      } catch (err) {
        setIsUploading(false);
        setIsLoading(false);
        toast.error("Resim yüklenemedi: " + err.message);
        return;
      }
    } else if (iconType === "emoji" && selectedEmoji) {
      iconUrl = selectedEmoji;
    }

    const result = await createServer(serverName, user?.uid, iconUrl);
    setIsLoading(false);

    if (result.success) {
      setServerName("");
      setSelectedEmoji("");
      setSelectedImage(null);
      setImagePreview(null);
      setIconType("emoji");
      setShowEmojiPicker(false);
      toast.success("Sunucu başarıyla oluşturuldu! 🎉");
      onClose();
    } else {
      toast.error(result.error || "Sunucu oluşturulamadı.");
    }
  };

  const handleEmojiClick = (emojiData) => {
      setSelectedEmoji(emojiData.emoji);
      setSelectedImage(null);
      setImagePreview(null);
      setIconType("emoji");
      setShowEmojiPicker(false);
  };

  const handleClearIcon = () => {
    setSelectedEmoji("");
    setSelectedImage(null);
    setImagePreview(null);
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
       {/* Animated background gradient */}
       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>

       <div className="glass-modal w-full max-w-md flex flex-col animate-nds-scale-in rounded-3xl border border-nds-border-medium bg-gradient-to-br from-nds-bg-deep/95 via-nds-bg-secondary/95 to-nds-bg-tertiary/95 shadow-nds-elevated relative overflow-hidden backdrop-blur-2xl">
          {/* Top glow effect */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-indigo-500/10 blur-[60px] pointer-events-none"></div>
          
          {/* Animated Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-10 left-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
          </div>

          {/* ESC Close Button - Premium Style */}
          <div
            className="absolute top-5 right-5 flex flex-col items-center group cursor-pointer z-[10000]"
            onClick={onClose}
          >
            <div className="w-9 h-9 rounded-xl glass-strong border border-nds-border-light flex items-center justify-center text-nds-text-tertiary group-hover:bg-gradient-to-br group-hover:from-nds-danger/20 group-hover:to-nds-danger/30 group-hover:text-nds-danger group-hover:border-nds-danger/30 transition-all duration-medium hover:scale-110 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] relative group/close">
              <X
                size={18}
                strokeWidth={2.5}
                className="relative z-10 group-hover/close:rotate-90 transition-transform duration-300"
              />
            </div>
            <span className="text-[9px] font-bold text-nds-text-tertiary mt-1 group-hover:text-nds-text-secondary transition-colors">
              ESC
            </span>
          </div>

          <div className="relative z-10">
              {/* Header */}
              <div className="px-8 pt-8 pb-4 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Sunucunu Oluştur</h2>
                  <p className="text-[#949ba4] text-sm leading-relaxed">
                    Sunucun senin ve arkadaşların için bir buluşma noktasıdır. <br/>İsmini koy ve bir simge ekle.
                  </p>
              </div>

              <div className="p-8 pt-2">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Icon Type Selector */}
                    <div className="flex justify-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setIconType("emoji")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                          iconType === "emoji" 
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" 
                            : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Smile size={14} className="inline mr-1.5" />
                        Emoji
                      </button>
                      <button
                        type="button"
                        onClick={() => setIconType("image")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                          iconType === "image" 
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" 
                            : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Image size={14} className="inline mr-1.5" />
                        Resim
                      </button>
                    </div>

                    {/* Icon Selector */}
                    <div className="flex justify-center py-4">
                      <div className="relative group/emoji">
                        {/* Ring Animation */}
                        <div className={`absolute -inset-1 rounded-full opacity-0 group-hover/emoji:opacity-100 blur transition-opacity duration-500 ${
                          iconType === "image" ? "bg-gradient-to-br from-purple-500 to-pink-500" : "bg-gradient-to-br from-indigo-500 to-purple-500"
                        }`}></div>
                        
                        {/* Hidden file input */}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleImageSelect} 
                          accept="image/*" 
                          className="hidden" 
                        />
                        
                        <div 
                           onClick={() => iconType === "emoji" ? setShowEmojiPicker(!showEmojiPicker) : fileInputRef.current?.click()}
                           className={`w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center flex-col text-gray-400 hover:border-white/30 hover:text-white transition-all cursor-pointer bg-black/20 overflow-hidden relative z-10 group-hover/emoji:scale-105 duration-300 ${
                             isUploading ? "pointer-events-none" : ""
                           } ${iconType === "image" ? "border-purple-500/20" : "border-white/10"}`}
                        >
                          {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 size={28} className="text-purple-400 animate-spin" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300/80">Yükleniyor...</span>
                            </div>
                          ) : imagePreview ? (
                              <img src={imagePreview} alt="Önizleme" className="w-full h-full object-cover" />
                          ) : selectedEmoji ? (
                              <span className="text-5xl drop-shadow-lg scale-110 transition-transform">{selectedEmoji}</span>
                          ) : (
                              <>
                                  <div className={`mb-1 p-2 rounded-full ${iconType === "image" ? "bg-purple-500/10" : "bg-indigo-500/10"}`}>
                                      {iconType === "image" ? (
                                        <Image size={20} className="text-purple-400" />
                                      ) : (
                                        <Smile size={20} className="text-indigo-400" />
                                      )}
                                  </div>
                                  <span className={`text-[10px] font-bold uppercase tracking-widest ${iconType === "image" ? "text-purple-300/80" : "text-indigo-300/80"}`}>
                                    {iconType === "image" ? "Resim Seç" : "Emoji Seç"}
                                  </span>
                              </>
                          )}
                           
                           {/* Overlay on Hover */}
                           {(imagePreview || selectedEmoji) && !isUploading && (
                             <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm">
                               {iconType === "image" ? (
                                 <Image size={24} className="text-white mb-1" />
                               ) : (
                                 <Smile size={24} className="text-white mb-1" />
                               )}
                               <span className="text-[9px] font-bold text-white uppercase tracking-wider">Değiştir</span>
                             </div>
                           )}
                        </div>
                        
                        {/* Clear Button */}
                        {(imagePreview || selectedEmoji) && !isUploading && (
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleClearIcon(); }}
                            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center z-20 hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <X size={12} />
                          </button>
                        )}
                        
                        {showEmojiPicker && iconType === "emoji" && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowEmojiPicker(false)}>
                                <div className="relative shadow-2xl rounded-xl animate-in zoom-in-95 duration-200 scale-110" onClick={(e) => e.stopPropagation()}>
                                  <EmojiPicker 
                                      onEmojiClick={handleEmojiClick}
                                      theme="dark"
                                      lazyLoadEmojis={true}
                                  />
                                </div>
                            </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                         <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                         Sunucu Adı
                      </label>
                      <Input 
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        placeholder="Sunucunun adı ne olsun?"
                        maxLength={30}
                        className="bg-black/20 border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-white placeholder:text-gray-600 transition-all duration-300 h-12 text-center text-lg font-medium tracking-tight rounded-xl shadow-inner"
                        autoFocus
                      />
                      <p className="text-xs text-gray-500 text-center pt-1">
                         Topluluğunu oluştururken yaratıcı ol!
                      </p>
                    </div>

                    <div className="flex justify-between items-center ">
                       <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            type="button"
                            className="hover:bg-white/5 text-gray-400 hover:text-white px-6"
                       >
                         İptal
                       </Button>
                       <Button 
                            type="submit" 
                            loading={isLoading || isUploading} 
                            disabled={!serverName.trim() || isUploading}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 px-8 flex-1 ml-4 h-12 rounded-xl"
                       >
                         {isUploading ? "Resim Yükleniyor..." : "Oluştur"}
                       </Button>
                    </div>
                  </form>

                  {/* Footer Section */}
                  <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <h4 className="text-gray-400 text-xs font-bold uppercase mb-3 tracking-widest">Zaten bir davetin var mı?</h4>
                    <Button 
                      className="w-full !bg-gradient-to-r !from-emerald-500 !to-green-600 hover:!from-emerald-600 hover:!to-green-700 text-white !shadow-lg !shadow-emerald-500/20 transition-all h-11 border-0"
                      onClick={onJoinClick}
                    >
                      Bir Sunucuya Katıl
                    </Button>
                  </div>
              </div>
           </div>
       </div>
    </div>,
    document.body
  );
}
