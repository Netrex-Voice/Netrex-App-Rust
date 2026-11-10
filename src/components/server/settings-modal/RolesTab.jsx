"use client";

import { useState } from "react";
import { Shield, Settings, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import { ColorPicker, PremiumColorInput } from "./components/ColorPicker";

const PERMISSIONS = [
  { id: "MANAGE_SERVER", label: "Sunucuyu Yönet" },
  { id: "MANAGE_CHANNELS", label: "Kanalları Yönet" },
  { id: "MANAGE_ROLES", label: "Rolleri Yönet" },
  { id: "KICK_MEMBERS", label: "Üyeleri At" },
  { id: "BAN_MEMBERS", label: "Üyeleri Yasakla" },
  { id: "MUTE_MEMBERS", label: "Üyeleri Sustur" },
  { id: "DEAFEN_MEMBERS", label: "Üyeleri Sağırlaştır" },
  { id: "KICK_VOICE_MEMBERS", label: "Sesli Kanaldan At" },
  { id: "MOVE_MEMBERS", label: "Üyeleri Taşı" },
  { id: "MANAGE_WATCH_PARTY", label: "Watch Party'yi Yönet" },
];

export default function RolesTab({ roles, onCreate, onUpdate, onDelete, showCreateModal, setShowCreateModal }) {
  const sortedRoles = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0));
  const [editingRole, setEditingRole] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#6366f1");

  const handleCreate = async () => {
    if (!newRoleName.trim()) {
      toast.error("Rol adı boş olamaz");
      return;
    }
    await onCreate(newRoleName, newRoleColor);
    toast.success("Rol oluşturuldu");
    setNewRoleName("");
    setNewRoleColor("#6366f1");
    setShowCreateModal(false);
  };

  if (editingRole) {
    const role = roles.find(r => r.id === editingRole);
    if (!role) {
      setEditingRole(null);
      return null;
    }

    const togglePermission = (permId) => {
      const currentPerms = role.permissions || [];
      const newPerms = currentPerms.includes(permId) 
        ? currentPerms.filter(p => p !== permId)
        : [...currentPerms, permId];
      onUpdate(role.id, { permissions: newPerms });
    };

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setEditingRole(null)}>
            ← Geri
          </Button>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }}></div>
            {role.name} Düzenle
          </h3>
        </div>
        
        {/* Role Name & Color */}
        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">Rol Bilgileri</h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Rol Adı</label>
              <Input 
                value={role.name} 
                onChange={(e) => onUpdate(role.id, { name: e.target.value })} 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Renk</label>
              <PremiumColorInput 
                value={role.color} 
                onChange={(color) => onUpdate(role.id, { color })} 
              />
              <ColorPicker value={role.color} onChange={(color) => onUpdate(role.id, { color })} />
            </div>
          </div>
        </div>
        
        {/* Permissions */}
        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">İzinler</h4>
          <div className="space-y-2">
            {PERMISSIONS.map(perm => (
              <div 
                key={perm.id} 
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" 
                onClick={() => togglePermission(perm.id)}
              >
                <span className="text-gray-300">{perm.label}</span>
                <div className={`w-12 h-7 rounded-full relative transition-colors ${role.permissions?.includes(perm.id) ? "bg-green-500" : "bg-gray-600"}`}>
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${role.permissions?.includes(perm.id) ? "left-6" : "left-1"}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delete Role */}
        {!role.isDefault && (
          <div className="glass-strong rounded-2xl border border-red-500/30 overflow-hidden p-5 shadow-soft-lg bg-red-500/5">
            <Button 
              variant="danger" 
              onClick={() => {
                if(window.confirm("Bu rolü silmek istediğinize emin misiniz?")) {
                  onDelete(role.id);
                  setEditingRole(null);
                  toast.success("Rol silindi");
                }
              }}
            >
              <Trash2 size={16} className="mr-2" />
              Rolü Sil
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield size={20} className="text-purple-400" />
          Roller
        </h3>
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="glass-strong rounded-2xl border border-indigo-500/30 overflow-hidden p-5 shadow-soft-lg bg-indigo-500/5 animate-in fade-in slide-in-from-top-2 duration-200">
          <h4 className="text-sm font-bold text-white mb-4">Yeni Rol Oluştur</h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Rol Adı</label>
              <Input 
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Rol adını girin..."
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Renk</label>
              <PremiumColorInput 
                value={newRoleColor} 
                onChange={setNewRoleColor} 
              />
              <ColorPicker value={newRoleColor} onChange={setNewRoleColor} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                İptal
              </Button>
              <Button onClick={handleCreate}>
                <Check size={14} className="mr-1" />
                Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
        <div className="space-y-2">
          {sortedRoles.map(role => (
            <div 
              key={role.id} 
              onClick={() => setEditingRole(role.id)} 
              className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl border border-white/5 hover:border-white/10 group cursor-pointer hover:bg-[#2b2d31] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }}></div>
                <span className="font-medium text-gray-200">{role.name}</span>
                {role.isDefault && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">Varsayılan</span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <Settings size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                {!role.isDefault && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if(window.confirm("Rolü sil?")) onDelete(role.id);
                    }} 
                    className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
