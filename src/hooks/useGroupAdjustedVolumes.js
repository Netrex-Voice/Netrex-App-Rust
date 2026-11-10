import { useMemo } from "react";
import { useVoiceGroupStore, computeListenFactor } from "@/src/store/voiceGroupStore";
import { useSettingsStore } from "@/src/store/settingsStore";

/**
 * Kullanıcının kişi başı ses ayarlarını (0–1+) konuşma grubu kurallarıyla birleştirir:
 *  - başka grupları dinleme seviyesi (grup başına ayrı kaydırıcı)
 *  - özel sohbet (fısıltı) sırasında partner dışındakilerin kısılması
 * Ses uygulayan hook'lar (normal + uzamsal) ham `volumes` yerine bunu kullanır.
 *
 * Gruplar hiç kullanılmıyorsa ve özel sohbet yoksa ham `volumes` aynen döner (hiçbir şey değişmez).
 */
export function useGroupAdjustedVolumes(volumes, identities) {
  const assignments = useVoiceGroupStore((s) => s.assignments);
  const localIdentity = useVoiceGroupStore((s) => s.localIdentity);
  const talk = useVoiceGroupStore((s) => s.talk);
  const whisperTargetId = useVoiceGroupStore((s) => s.whisperTargetId);
  const replyTo = useVoiceGroupStore((s) => s.replyTo);
  const incoming = useVoiceGroupStore((s) => s.incoming);
  const groupListenVolumes = useSettingsStore((s) => s.groupListenVolumes);

  const identitiesKey = identities.join("|");

  return useMemo(() => {
    const ids = identitiesKey ? identitiesKey.split("|") : [];
    const state = { assignments, localIdentity, talk, whisperTargetId, replyTo, incoming };
    let changed = false;
    const out = { ...volumes };
    ids.forEach((id) => {
      if (id === localIdentity) return;
      const factor = computeListenFactor(id, state, groupListenVolumes || {}, ids);
      if (factor === 1) return;
      out[id] = (volumes[id] ?? 1) * factor;
      changed = true;
    });
    return changed ? out : volumes;
  }, [volumes, identitiesKey, assignments, localIdentity, talk, whisperTargetId, replyTo, incoming, groupListenVolumes]);
}
