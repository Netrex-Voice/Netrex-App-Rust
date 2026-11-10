"use client";

import { useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { Settings, ChevronRight, Smile, Image as ImageIcon, Upload, Save, Trash2, Loader2 } from "lucide-react";
import { useServerStore } from "@/src/store/serverStore";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import { toast } from "@/src/utils/toast";
import EmojiPicker from 'emoji-picker-react';
import { uploadServerIconToCloudinary, deleteImageFromCloudinary } from "@/src/utils/imageUpload";

/**
 * 📋 OverviewTab - OPTIMIZED Server Overview Settings
 * Memoized to prevent re-renders
 */
const OverviewTab = memo(function OverviewTab({ server, onUpdate, onDelete, isOwner, onClose }) {
  const { currentServer } = useServerStore();
  const liveServer = currentServer || server;
  
  const [name, setName] = useState(liveServer.name);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Icon editing states
  const [iconType, setIconType] = useState("emoji");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const fileInputRef = useRef(null);

  const currentIconUrl = liveServer.iconUrl;
  const isCurrentEmoji = currentIconUrl && !currentIconUrl.startsWith("http") && !currentIconUrl.startsWith("data:");
  const isCurrentImage = currentIconUrl && (currentIconUrl.startsWith("http") || currentIconUrl.startsWith("data:"));

  const handleUpdate = async () => {
    if (!name.trim() || name === liveServer.name) return;
    setIsLoading(true);
    await onUpdate(liveServer.id, { name });
    setIsLoading(false);
    toast.success("Sunucu güncellendi");
  };

  const handleDelete = async () => {
    await onDelete(liveServer.id);
    toast.success("Sunucu silindi");
    onClose();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen geçerli bir resim dosyası seçin.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resim boyutu 5MB'dan küçük olmalı.");
      return;
    }

    setSelectedImage(file);
    setSelectedEmoji("");
    setIconType("image");

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleEmojiClick = (emojiData) => {
    setSelectedEmoji(emojiData.emoji);
    setSelectedImage(null);
    setImagePreview(null);
    setIconType("emoji");
    setShowEmojiPicker(false);
  };

  const handleClearNewIcon = () => {
    setSelectedEmoji("");
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSaveIcon = async () => {
    let newIconUrl = null;

    if (iconType === "image" && selectedImage) {
      try {
        setIsUploadingIcon(true);
        newIconUrl = await uploadServerIconToCloudinary(selectedImage);
        setIsUploadingIcon(false);
      } catch (err) {
        setIsUploadingIcon(false);
        toast.error("Resim yüklenemedi: " + err.message);
        return;
      }
    } else if (iconType === "emoji" && selectedEmoji) {
      newIconUrl = selectedEmoji;
    }

    if (newIconUrl) {
      const oldIconUrl = liveServer.iconUrl;
      if (oldIconUrl && oldIconUrl.includes('cloudinary.com')) {
        deleteImageFromCloudinary(oldIconUrl).catch(err => 
          console.warn("Eski ikon silinemedi:", err)
        );
      }
      
      await onUpdate(liveServer.id, { iconUrl: newIconUrl });
      toast.success("Sunucu ikonu güncellendi!");
      handleClearNewIcon();
    }
  };

  const handleRemoveIcon = async () => {
    const oldIconUrl = liveServer.iconUrl;
    if (oldIconUrl && oldIconUrl.includes('cloudinary.com')) {
      deleteImageFromCloudinary(oldIconUrl).catch(err => 
        console.warn("Cloudinary'den silinemedi:", err)
      );
    }
    
    await onUpdate(liveServer.id, { iconUrl: null });
    toast.success("Sunucu ikonu kaldırıldı");
  };

  const hasNewIcon = selectedEmoji || selectedImage;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Settings size={20} className="text-indigo-400" />
        Genel Bakış
      </h3>

      {/* Server Icon */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
          Sunucu İkonu
        </h4>
        
        <div className="flex items-start gap-6">
          {/* Current Icon */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Mevcut</span>
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2b2d31] to-[#1e1f22] border border-white/10 flex items-center justify-center overflow-hidden">
              {isCurrentImage ? (
                <img src={currentIconUrl} alt="Server Icon" className="w-full h-full object-cover" loading="lazy" />
              ) : isCurrentEmoji ? (
                <span className="text-4xl">{currentIconUrl}</span>
              ) : (
                <span className="text-2xl font-bold text-gray-400">{liveServer.name?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {currentIconUrl && (
              <button 
                onClick={handleRemoveIcon}
                className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
              >
                Kaldır
              </button>
            )}
          </div>

          <div className="flex items-center pt-8">
            <ChevronRight size={20} className="text-gray-600" />
          </div>

          {/* New Icon Selector */}
          <div className="flex-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">Yeni İkon</span>
            
            {/* Icon Type Tabs */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setIconType("emoji")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  iconType === "emoji" 
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" 
                    : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                <Smile size={12} className="inline mr-1" />
                Emoji
              </button>
              <button
                type="button"
                onClick={() => setIconType("image")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  iconType === "image" 
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" 
                    : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                <ImageIcon size={12} className="inline mr-1" />
                Resim
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageSelect} 
                accept="image/*" 
                className="hidden" 
              />
              
              <div 
                onClick={() => iconType === "emoji" ? setShowEmojiPicker(true) : fileInputRef.current?.click()}
                className={`w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:scale-105 ${
                  iconType === "image" 
                    ? "border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50" 
                    : "border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50"
                } ${isUploadingIcon ? "pointer-events-none opacity-50" : ""}`}
              >
                {isUploadingIcon ? (
                  <Loader2 size={24} className="text-purple-400 animate-spin" />
                ) : imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                ) : selectedEmoji ? (
                  <span className="text-4xl">{selectedEmoji}</span>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-500">
                    {iconType === "image" ? <Upload size={20} /> : <Smile size={20} />}
                    <span className="text-[9px] uppercase">Seç</span>
                  </div>
                )}
              </div>

              {hasNewIcon && (
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={handleSaveIcon}
                    loading={isUploadingIcon}
                    disabled={isUploadingIcon}
                    size="sm"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs"
                  >
                    <Save size={14} className="mr-1" />
                    Kaydet
                  </Button>
                  <button 
                    onClick={handleClearNewIcon}
                    className="text-[10px] text-gray-400 hover:text-white transition-colors"
                  >
                    Temizle
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Emoji Picker Modal */}
        {showEmojiPicker && createPortal(
          <div 
            className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/80 backdrop-blur-sm" 
            onClick={() => setShowEmojiPicker(false)}
          >
            <div className="relative shadow-2xl rounded-xl" onClick={(e) => e.stopPropagation()}>
              <EmojiPicker 
                onEmojiClick={handleEmojiClick}
                theme="dark"
                lazyLoadEmojis={true}
              />
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Server Name */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
          Sunucu Adı
        </h4>
        <div className="flex gap-3">
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="flex-1"
            placeholder="Sunucu adı..."
          />
          <Button 
            onClick={handleUpdate} 
            loading={isLoading} 
            disabled={name === liveServer.name}
            className="px-4"
          >
            <Save size={16} />
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div className="glass-strong rounded-2xl border border-red-500/30 overflow-hidden p-5 shadow-soft-lg bg-red-500/5">
          <h4 className="text-xs font-bold text-red-400 uppercase mb-4 flex items-center gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full"></div>
            Tehlikeli Bölge
          </h4>
          <p className="text-sm text-gray-400 mb-4">
            Bu işlem geri alınamaz. Sunucu ve tüm içeriği kalıcı olarak silinecektir.
          </p>
          <Button 
            variant="danger" 
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 size={16} className="mr-2" />
            Sunucuyu Sil
          </Button>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setShowDeleteModal(false)}></div>
          
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent z-10"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-red-500/10 blur-[50px] pointer-events-none"></div>

            <div className="p-8 text-center relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-900/10 flex items-center justify-center mx-auto mb-6 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.15)] border border-red-500/20">
                <Trash2 size={40} />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">Sunucuyu Sil</h3>
              
              <p className="text-gray-400 text-base mb-8 leading-relaxed">
                <span className="text-white font-bold">{liveServer.name}</span> sunucusunu silmek istediğinize emin misiniz? <br/>
                <span className="text-red-400/80 text-sm mt-2 block">Bu işlem geri alınamaz ve tüm kanal/mesaj verileri silinir.</span>
              </p>
              
              <div className="flex gap-4 justify-center">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowDeleteModal(false)}
                  className="hover:bg-white/5 text-gray-400 hover:text-white px-6 h-11"
                >
                  İptal
                </Button>
                <Button 
                  onClick={handleDelete}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 px-8 h-11 border-0"
                >
                  Evet, Sunucuyu Sil
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default OverviewTab;
