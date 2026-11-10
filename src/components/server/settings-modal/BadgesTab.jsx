"use client";

import { useState, useRef } from "react";
import Avatar from "@/src/components/ui/Avatar";
import { createPortal } from "react-dom";
import { Award, Edit3, Trash2, Upload, Check, Palette } from "lucide-react";
import { toast } from "sonner";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import { uploadBadgeIconToCloudinary, deleteImageFromCloudinary } from "@/src/utils/imageUpload";
import { BADGE_COLOR_PRESETS } from "./components/ColorPicker";

export default function BadgesTab({ badges, members, onCreate, onUpdate, onDelete, onAssign, onRemove, showCreateModal, setShowCreateModal, serverId }) {
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Create/Edit form states
  const [badgeName, setBadgeName] = useState("");
  const [badgeColor, setBadgeColor] = useState("#f59e0b");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [badgeIcon, setBadgeIcon] = useState(null);
  const [badgeIconPreview, setBadgeIconPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  // Reset form
  const resetForm = () => {
    setBadgeName("");
    setBadgeColor("#f59e0b");
    setBadgeDescription("");
    setBadgeIcon(null);
    setBadgeIconPreview(null);
    setIsEditing(false);
    setSelectedBadge(null);
  };

  // Handle image select
  const handleIconSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen geçerli bir resim dosyası seçin.");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Resim boyutu 2MB'dan küçük olmalı.");
      return;
    }
    
    setBadgeIcon(file);
    const reader = new FileReader();
    reader.onload = (ev) => setBadgeIconPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Create badge
  const handleCreate = async () => {
    if (!badgeName.trim()) {
      toast.error("Rozet adı gerekli.");
      return;
    }
    
    setIsUploading(true);
    try {
      let iconUrl = null;
      if (badgeIcon) {
        iconUrl = await uploadBadgeIconToCloudinary(badgeIcon);
      }
      
      const result = await onCreate(serverId, {
        name: badgeName.trim(),
        color: badgeColor,
        description: badgeDescription.trim(),
        iconUrl
      });
      
      if (result.success) {
        toast.success("Rozet oluşturuldu! 🎉");
        resetForm();
        setShowCreateModal(false);
      } else {
        toast.error("Rozet oluşturulamadı: " + result.error);
      }
    } catch (error) {
      toast.error("Hata: " + error.message);
    }
    setIsUploading(false);
  };

  // Edit badge
  const handleEdit = (badge) => {
    setSelectedBadge(badge);
    setBadgeName(badge.name);
    setBadgeColor(badge.color || "#f59e0b");
    setBadgeDescription(badge.description || "");
    setBadgeIconPreview(badge.iconUrl);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  // Update badge
  const handleUpdate = async () => {
    if (!badgeName.trim() || !selectedBadge) return;
    
    setIsUploading(true);
    try {
      let iconUrl = selectedBadge.iconUrl;
      if (badgeIcon) {
        iconUrl = await uploadBadgeIconToCloudinary(badgeIcon);
        // Delete old icon if exists
        if (selectedBadge.iconUrl) {
          deleteImageFromCloudinary(selectedBadge.iconUrl).catch(console.warn);
        }
      }
      
      const result = await onUpdate(serverId, selectedBadge.id, {
        name: badgeName.trim(),
        color: badgeColor,
        description: badgeDescription.trim(),
        iconUrl
      });
      
      if (result.success) {
        toast.success("Rozet güncellendi!");
        resetForm();
        setShowCreateModal(false);
      } else {
        toast.error("Güncellenemedi: " + result.error);
      }
    } catch (error) {
      toast.error("Hata: " + error.message);
    }
    setIsUploading(false);
  };

  // Delete badge
  const handleDeleteClick = (badge) => {
    setDeleteTarget(badge);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    const result = await onDelete(serverId, deleteTarget.id);
    if (result.success) {
      // Delete icon from Cloudinary
      if (deleteTarget.iconUrl) {
        deleteImageFromCloudinary(deleteTarget.iconUrl).catch(console.warn);
      }
      toast.success("Rozet silindi.");
    } else {
      toast.error("Silinemedi: " + result.error);
    }
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  // Assign badge modal
  const openAssignModal = (badge) => {
    setSelectedBadge(badge);
    setShowAssignModal(true);
  };

  const handleAssign = async (memberId) => {
    if (!selectedBadge) return;
    const result = await onAssign(serverId, memberId, selectedBadge.id);
    if (result.success) {
      toast.success("Rozet atandı!");
    } else {
      toast.error("Atanamadı: " + result.error);
    }
  };

  const handleRemove = async (memberId) => {
    if (!selectedBadge) return;
    const result = await onRemove(serverId, memberId, selectedBadge.id);
    if (result.success) {
      toast.success("Rozet kaldırıldı.");
    }
  };

  // Get members with/without this badge
  const getMembersWithBadge = (badgeId) => {
    return members.filter(m => m.badges?.includes(badgeId));
  };

  const getMembersWithoutBadge = (badgeId) => {
    return members.filter(m => !m.badges?.includes(badgeId));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Award size={20} className="text-amber-400" />
        Rozetler ({badges.length})
      </h3>

      {/* Badge List */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
        {badges.length === 0 ? (
          <div className="text-center py-12">
            <Award size={48} className="mx-auto text-white/10 mb-4" />
            <p className="text-[#949ba4] text-sm mb-2">Henüz rozet oluşturulmamış</p>
            <p className="text-[#5c5e66] text-xs">Üyelere özel rozetler vererek topluluğunuzu canlandırın!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {badges.map(badge => (
              <div 
                key={badge.id}
                className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {/* Badge Icon */}
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10"
                    style={{ backgroundColor: `${badge.color}20` }}
                  >
                    {badge.iconUrl ? (
                      <img src={badge.iconUrl} alt={badge.name} className="w-6 h-6 object-contain" />
                    ) : (
                      <Award size={20} style={{ color: badge.color }} />
                    )}
                  </div>
                  
                  {/* Badge Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{badge.name}</span>
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: badge.color }}
                      />
                    </div>
                    {badge.description && (
                      <p className="text-xs text-[#949ba4] truncate max-w-[200px]">{badge.description}</p>
                    )}
                    <p className="text-[10px] text-[#5c5e66]">
                      {getMembersWithBadge(badge.id).length} üye
                    </p>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openAssignModal(badge)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-medium hover:bg-indigo-500/30 transition-colors"
                  >
                    Ata
                  </button>
                  <button
                    onClick={() => handleEdit(badge)}
                    className="p-1.5 rounded-lg bg-white/5 text-[#949ba4] hover:bg-white/10 hover:text-white transition-all"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(badge)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Badge Modal */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => { resetForm(); setShowCreateModal(false); }} />
          
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Award className="text-amber-400" />
                {isEditing ? "Rozeti Düzenle" : "Yeni Rozet Oluştur"}
              </h3>
              
              <div className="space-y-4">
                {/* Icon Upload */}
                <div>
                  <label className="text-xs font-bold text-[#949ba4] uppercase mb-2 block">İkon</label>
                  <div className="flex items-center gap-4">
                    <input type="file" ref={fileInputRef} onChange={handleIconSelect} accept="image/*" className="hidden" />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 flex items-center justify-center cursor-pointer hover:border-amber-500/50 transition-all"
                    >
                      {badgeIconPreview ? (
                        <img src={badgeIconPreview} alt="Preview" className="w-10 h-10 object-contain" />
                      ) : (
                        <Upload size={24} className="text-amber-500/50" />
                      )}
                    </div>
                    <div className="text-xs text-[#5c5e66]">
                      64x64 piksel önerilir<br/>
                      Max 2MB
                    </div>
                  </div>
                </div>
                
                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-[#949ba4] uppercase mb-2 block">Rozet Adı *</label>
                  <Input 
                    value={badgeName}
                    onChange={(e) => setBadgeName(e.target.value)}
                    placeholder="Örn: VIP, Destekçi, Kurucu Üye..."
                    maxLength={32}
                  />
                </div>
                
                {/* Color */}
                <div>
                  <label className="text-xs font-bold text-[#949ba4] uppercase mb-2 block">Renk</label>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_COLOR_PRESETS.map(color => (
                      <button
                        key={color}
                        onClick={() => setBadgeColor(color)}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          badgeColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22] scale-110" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {badgeColor === color && <Check size={14} className="text-white mx-auto" />}
                      </button>
                    ))}
                    <label className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/20">
                      <input type="color" value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                      <Palette size={14} className="text-[#949ba4]" />
                    </label>
                  </div>
                </div>
                
                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-[#949ba4] uppercase mb-2 block">Açıklama</label>
                  <textarea
                    value={badgeDescription}
                    onChange={(e) => setBadgeDescription(e.target.value)}
                    placeholder="Bu rozet ne anlama geliyor?"
                    maxLength={100}
                    rows={2}
                    className="w-full bg-[#111214] border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-[#5c5e66] focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => { resetForm(); setShowCreateModal(false); }}>
                  İptal
                </Button>
                <Button 
                  onClick={isEditing ? handleUpdate : handleCreate}
                  loading={isUploading}
                  disabled={!badgeName.trim() || isUploading}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
                >
                  {isEditing ? "Güncelle" : "Oluştur"}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] to-[#111214] p-6">
            <h3 className="text-lg font-bold text-white mb-2">Rozeti Sil</h3>
            <p className="text-[#949ba4] text-sm mb-6">
              <span className="text-white font-semibold">{deleteTarget?.name}</span> rozetini silmek istediğinize emin misiniz? Bu rozet tüm üyelerden kaldırılacak.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>İptal</Button>
              <Button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-white border-0">Sil</Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Badge Modal */}
      {showAssignModal && selectedBadge && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => { setShowAssignModal(false); setSelectedBadge(null); }} />
          
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10"
                  style={{ backgroundColor: `${selectedBadge.color}20` }}
                >
                  {selectedBadge.iconUrl ? (
                    <img src={selectedBadge.iconUrl} alt={selectedBadge.name} className="w-6 h-6 object-contain" />
                  ) : (
                    <Award size={20} style={{ color: selectedBadge.color }} />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedBadge.name}</h3>
                  <p className="text-xs text-[#949ba4]">Rozet Ata/Kaldır</p>
                </div>
              </div>
              
              {/* Members with badge */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2">Bu Rozete Sahip Üyeler</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {getMembersWithBadge(selectedBadge.id).length === 0 ? (
                    <p className="text-xs text-[#5c5e66] py-2">Henüz kimse bu rozete sahip değil.</p>
                  ) : (
                    getMembersWithBadge(selectedBadge.id).map(member => (
                      <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                        <div className="flex items-center gap-2">
                          <Avatar
                            uid={member.id || member.userId}
                            src={member.photoURL}
                            name={member.displayName}
                            color={member.profileColor}
                            size="sm"
                            borderless
                          />
                          <span className="text-sm text-white">{member.displayName}</span>
                        </div>
                        <button 
                          onClick={() => handleRemove(member.id)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                        >
                          Kaldır
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Members without badge */}
              <div>
                <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2">Rozet Ata</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {getMembersWithoutBadge(selectedBadge.id).length === 0 ? (
                    <p className="text-xs text-[#5c5e66] py-2">Tüm üyeler bu rozete sahip.</p>
                  ) : (
                    getMembersWithoutBadge(selectedBadge.id).map(member => (
                      <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-2">
                          <Avatar
                            uid={member.id || member.userId}
                            src={member.photoURL}
                            name={member.displayName}
                            color={member.profileColor}
                            size="sm"
                            borderless
                          />
                          <span className="text-sm text-[#dbdee1]">{member.displayName}</span>
                        </div>
                        <button 
                          onClick={() => handleAssign(member.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 bg-indigo-500/10 rounded-lg hover:bg-indigo-500/20 transition-colors"
                        >
                          Ata
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button variant="ghost" onClick={() => { setShowAssignModal(false); setSelectedBadge(null); }}>
                  Kapat
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
