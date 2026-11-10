"use client";
import { useState, useEffect } from "react";
import Modal from "@/src/components/ui/Modal";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import { useServerStore } from "@/src/store/serverStore";
import { Hash, Volume2 } from "lucide-react";

export default function CreateChannelModal({ isOpen, onClose, channelType = "text", serverId }) {
  const [channelName, setChannelName] = useState("");
  const [selectedType, setSelectedType] = useState(channelType);
  const [isLoading, setIsLoading] = useState(false);
  const createChannel = useServerStore((s) => s.createChannel);

  useEffect(() => {
    if (isOpen) {
      setChannelName("");
      setSelectedType(channelType);
    }
  }, [isOpen, channelType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    setIsLoading(true);
    await createChannel(serverId, channelName.trim(), selectedType);
    setIsLoading(false);
    onClose();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
       {/* Animated background gradient */}
       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none"></div>

       <div className="glass-modal w-full max-w-md flex flex-col animate-nds-scale-in rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Top glow effect */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-20 bg-indigo-500/10 blur-[50px] pointer-events-none"></div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 relative z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                  Kanal Oluştur
              </h2>
              <button 
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-200 group relative"
              >
                  <span className="absolute -bottom-8 right-0 text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-1 rounded">ESC</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
          </div>

          <div className="p-6 relative z-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Channel Type Selection */}
                <div className="space-y-3">
                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                         Kanal Türü
                     </label>
                     <div className="grid gap-3">
                         {/* Text Channel Option */}
                         <div 
                            onClick={() => setSelectedType('text')}
                            className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                                selectedType === 'text' 
                                ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]' 
                                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                            }`}
                         >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${selectedType === 'text' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-gray-300'}`}>
                                <Hash size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className={`font-bold text-sm mb-0.5 transition-colors ${selectedType === 'text' ? 'text-white' : 'text-gray-300'}`}>Metin Kanalı</h4>
                                <p className="text-xs text-gray-400 leading-relaxed">Mesaj, resim, GIF ve dosya gönder.</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                selectedType === 'text' ? 'border-indigo-500 scale-110' : 'border-white/20 group-hover:border-white/40'
                            }`}>
                                <div className={`w-2.5 h-2.5 rounded-full bg-indigo-500 transition-[transform,opacity] duration-200 ease-ui-out ${selectedType === 'text' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} />
                            </div>
                         </div>

                         {/* Voice Channel Option */}
                         <div 
                            onClick={() => setSelectedType('voice')}
                            className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                                selectedType === 'voice' 
                                ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]' 
                                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                            }`}
                         >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${selectedType === 'voice' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-gray-300'}`}>
                                <Volume2 size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className={`font-bold text-sm mb-0.5 transition-colors ${selectedType === 'voice' ? 'text-white' : 'text-gray-300'}`}>Ses Kanalı</h4>
                                <p className="text-xs text-gray-400 leading-relaxed">Sesli sohbet, video ve ekran paylaşımı.</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                selectedType === 'voice' ? 'border-indigo-500 scale-110' : 'border-white/20 group-hover:border-white/40'
                            }`}>
                                <div className={`w-2.5 h-2.5 rounded-full bg-indigo-500 transition-[transform,opacity] duration-200 ease-ui-out ${selectedType === 'voice' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} />
                            </div>
                         </div>
                     </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                     Kanal Adı
                  </label>
                  <div className="relative group/input">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within/input:text-indigo-400">
                        {selectedType === 'text' ? <Hash size={16} /> : <Volume2 size={16} />}
                    </div>
                    <Input 
                        value={channelName}
                        onChange={(e) => setChannelName(selectedType === 'text' ? e.target.value.toLowerCase().replace(/\s+/g, '-') : e.target.value)}
                        placeholder={selectedType === 'text' ? 'yeni-kanal' : 'Genel Sohbet'}
                        className="pl-9 bg-black/20 border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-white placeholder:text-gray-600 transition-all duration-300 h-11"
                        autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                     {selectedType === 'text' ? 'Küçük harfler, tireler ve alt çizgiler otomatik uygulanır.' : 'Kanal adı okunaklı ve anlaşılır olmalıdır.'}
                  </p>
                </div>

                <div className="flex justify-between items-center border-t border-white/5 mt-2">
                   <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        type="button"
                        className="hover:bg-white/5 text-gray-400 hover:text-white"
                   >
                     İptal
                   </Button>
                   <Button 
                        type="submit" 
                        loading={isLoading} 
                        disabled={!channelName.trim()}
                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/20 px-8"
                   >
                     Oluştur
                   </Button>
                </div>
              </form>
          </div>
       </div>
    </div>
  );
}
