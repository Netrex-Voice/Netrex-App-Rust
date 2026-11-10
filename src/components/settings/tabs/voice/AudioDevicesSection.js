import { Mic, Speaker } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { supportsOutputSelection } from "@/src/hooks/useAudioDeviceSync";

// Android Chrome, ses yönlendirmesini giriş listesinde Android'in cihaz türü adlarıyla sunar:
//   "Speakerphone"       → telefonun hoparlörü
//   "Headset earpiece"   → KABLOLU KULAKLIK (telefonun ahizesi değil! takılı değilse ses gelmez)
//   "Earpiece"/"Handset" → telefonun kendi ahizesi (çoğu telefonda listelenmez; "Varsayılan" ahizedir)
// Birini seçmek gelen sesin de o cihaza gitmesini sağlar.
const SPEAKER_RE = /speakerphone/i;
const WIRED_RE = /headset|headphone/i;
const EARPIECE_RE = /earpiece|handset/i;
const isBuiltInEarpiece = (label) => EARPIECE_RE.test(label) && !WIRED_RE.test(label);

function friendlyInputLabel(d) {
  const label = d.label || "";
  if (SPEAKER_RE.test(label)) return "Hoparlör (Speakerphone)";
  if (WIRED_RE.test(label)) return "Kablolu kulaklık (Headset)";
  if (isBuiltInEarpiece(label)) return "Ahize (Earpiece)";
  return label || `Mikrofon ${d.deviceId.slice(0, 5)}`;
}

export default function AudioDevicesSection({ audioInputs, audioOutputs }) {

  const audioInputId = useSettingsStore(s => s.audioInputId);
  const setAudioInput = useSettingsStore(s => s.setAudioInput);
  const audioOutputId = useSettingsStore(s => s.audioOutputId);
  const setAudioOutput = useSettingsStore(s => s.setAudioOutput);

  // Tarayıcının kendi "default"/"communications" girişleri bizim "Varsayılan" ile aynı şey: tekrar göstermeyelim
  const inputs = audioInputs.filter(
    (d) => d.deviceId !== "default" && d.deviceId !== "communications",
  );
  const speakerInput = inputs.find((d) => SPEAKER_RE.test(d.label));
  // Telefonun kendi ahizesi listelenmiyorsa "Varsayılan" ahizeyi temsil eder
  const earpieceInput = inputs.find((d) => isBuiltInEarpiece(d.label));
  const earpieceId = earpieceInput ? earpieceInput.deviceId : "default";
  const hasPhoneRouting = !!speakerInput;
  const outputsFiltered = audioOutputs.filter(
    (d) => d.deviceId !== "default" && d.deviceId !== "communications",
  );
  const outputSelectable = supportsOutputSelection() && outputsFiltered.length > 0;

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Mic size={14} className="text-cyan-400" />
        </div>
        Ses Cihazları
      </h4>
      
      <div className="relative z-10 space-y-4">
        {/* Mikrofon */}
        <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-cyan-500/20 transition-colors duration-300">
          <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 flex items-center gap-2">
            <Mic size={12} className="text-cyan-400" />
            Giriş Cihazı (Mikrofon)
          </label>
          <p className="text-xs text-[#949ba4] mb-2 -mt-1">Sesinizi alacak mikrofon. “Varsayılan”, bilgisayarınızda seçili olanı kullanır.</p>
          <div className="relative">
            <select
              value={audioInputId}
              // Odaya uygulama useAudioDeviceSync'te (tek yetkili); burada yalnızca seçim kaydedilir
              onChange={(e) => setAudioInput(e.target.value)}
              className="w-full bg-[#2b2d31] border border-white/10 text-white p-3 rounded-xl hover:border-cyan-500/50 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none appearance-none cursor-pointer transition-all duration-300 pr-10"
            >
              <option value="default">Varsayılan</option>
              {inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {friendlyInputLabel(d)}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
              <Mic size={16} />
            </div>
          </div>
        </div>
        
        {/* Telefon: sesi hoparlörden / ahizeden al (Android'de çıkışı bu girişler belirler) */}
        {hasPhoneRouting && (
          <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5">
            <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 flex items-center gap-2">
              <Speaker size={12} className="text-emerald-400" />
              Ses Nereden Gelsin?
            </label>
            <p className="text-xs text-[#949ba4] mb-3 -mt-1">
              Telefonda gelen sesin hoparlörden mi yoksa ahizeden/kulaklıktan mı çalacağını belirler.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: speakerInput?.deviceId, title: "Hoparlör", sub: "Sesi yüksek ver" },
                { id: earpieceId, title: "Ahize", sub: "Kulağa tutarak" },
              ].map(({ id, title, sub }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setAudioInput(id)}
                  className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${
                    audioInputId === id
                      ? "bg-emerald-500/20 border-emerald-500/60 text-white"
                      : "bg-[#2b2d31] border-white/10 text-[#b5bac1] hover:border-emerald-500/40"
                  }`}
                >
                  <div className="text-sm font-bold">{title}</div>
                  <div className="text-[11px] text-[#949ba4]">{sub}</div>
                </button>
              ))}
            </div>
            {/* Tanı: tarayıcının bildirdiği gerçek cihaz adları (sorun bildirirken işe yarar) */}
            <p className="text-[10px] text-[#5c5e66] mt-2 break-words">
              Algılanan girişler: {audioInputs.map((d) => d.label || "?").join(" · ") || "yok"}
            </p>
          </div>
        )}

        {/* Hoparlör */}
        <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
          <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 flex items-center gap-2">
            <Speaker size={12} className="text-indigo-400" />
            Çıkış Cihazı (Hoparlör)
          </label>
          <p className="text-xs text-[#949ba4] mb-2 -mt-1">
            {outputSelectable
              ? "Odadaki kişileri duyacağınız hoparlör veya kulaklık."
              : hasPhoneRouting
                ? "Bu cihazda tarayıcı çıkış listesi vermiyor. Hoparlör/ahize geçişi için yukarıdaki “Ses Nereden Gelsin?” kutusunu kullanın."
                : "Bu cihazda tarayıcı çıkış seçmeye izin vermiyor. Geçişi telefonun kendi ses çıkışı menüsünden yapın."}
          </p>
          <div className="relative">
            <select
              value={audioOutputId}
              onChange={(e) => setAudioOutput(e.target.value)}
              disabled={!outputSelectable}
              className="w-full bg-[#2b2d31] border border-white/10 text-white p-3 rounded-xl hover:border-indigo-500/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer transition-all duration-300 pr-10"
            >
              <option value="default">Varsayılan</option>
              {outputsFiltered.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Hoparlör ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
              <Speaker size={16} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
