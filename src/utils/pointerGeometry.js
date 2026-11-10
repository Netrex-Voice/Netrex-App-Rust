/**
 * Videonun ekranda GERÇEKTEN görüntülendiği alanı döndürür (kutunun içindeki, siyah boşluklar hariç).
 *
 * Video `object-contain` ile gösterildiği için kutu ile görüntü aynı boyutta değildir. İşaretçi
 * koordinatları kutuya göre hesaplanırsa imleç, paylaşılan ekrandaki gerçek noktadan kayar.
 * Hem gönderirken (fare → 0..1) hem çizerken (0..1 → piksel) bu alan kullanılmalıdır.
 *
 * @param {HTMLElement} container  <video> elementini içeren kutu
 * @param {HTMLElement} [origin]   Dönen left/top değerlerinin ölçüleceği eleman (varsayılan: container)
 * @returns {{left:number, top:number, width:number, height:number}}  origin'e göre piksel
 */
export function getVideoContentRect(container, origin = container) {
  const originRect = (origin || container).getBoundingClientRect();
  const video = container.querySelector?.("video");
  if (!video) {
    const r = container.getBoundingClientRect();
    return { left: r.left - originRect.left, top: r.top - originRect.top, width: r.width, height: r.height };
  }

  const v = video.getBoundingClientRect();
  let left = v.left - originRect.left;
  let top = v.top - originRect.top;
  let width = v.width;
  let height = v.height;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw && vh && width && height) {
    // object-contain: oranı koruyarak elemanın içine sığdırılır, artan alan ortalanır
    const scale = Math.min(width / vw, height / vh);
    const cw = vw * scale;
    const ch = vh * scale;
    left += (width - cw) / 2;
    top += (height - ch) / 2;
    width = cw;
    height = ch;
  }
  return { left, top, width, height };
}
