"use client";

import { useEffect } from "react";

/**
 * Tüm modal pencereler (role="dialog") için ortak klavye / odak davranışı. Görünmez, tek örnek yeter.
 *
 * 1. Esc: `data-esc-close` taşıyan en üstteki pencereyi kapatır (kendi Esc işleyicisi olmayanlar için);
 *    önce "Kapat/İptal" düğmesini, yoksa arka planı tıklar.
 * 2. Odak yakalama: pencere açılınca odak içine alınır (zaten içindeyse dokunulmaz), Tab / Shift+Tab pencerenin
 *    dışına kaçmaz.
 * 3. Kapanınca odak, pencereyi açan öğeye geri verilir.
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function visibleFocusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
  });
}

function topDialog() {
  const all = document.querySelectorAll('[role="dialog"]');
  return all.length ? all[all.length - 1] : null;
}

export default function ModalA11yManager() {
  useEffect(() => {
    const opener = new WeakMap(); // pencere -> açılmadan önce odaklı öğe
    const seen = new WeakSet();

    const scan = () => {
      document.querySelectorAll('[role="dialog"]').forEach((d) => {
        if (seen.has(d)) return;
        seen.add(d);
        opener.set(d, document.activeElement);
        if (!d.contains(document.activeElement)) {
          // Bir sonraki karede: içerik çizildikten sonra ilk odaklanabilir öğeye
          requestAnimationFrame(() => {
            if (!d.isConnected || d.contains(document.activeElement)) return;
            const first = visibleFocusables(d)[0];
            if (first) first.focus({ preventScroll: true });
          });
        }
      });
    };

    const removedDialogs = (nodes) => {
      nodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const ds = n.matches?.('[role="dialog"]') ? [n] : [...(n.querySelectorAll?.('[role="dialog"]') || [])];
        ds.forEach((d) => {
          const prev = opener.get(d);
          if (prev && prev.isConnected && !document.querySelector('[role="dialog"]')) {
            try { prev.focus({ preventScroll: true }); } catch (_) { /* odaklanamadı */ }
          }
        });
      });
    };

    const mo = new MutationObserver((muts) => {
      scan();
      muts.forEach((m) => removedDialogs(m.removedNodes));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();

    const onKey = (e) => {
      const d = topDialog();
      if (!d) return;
      if (e.key === "Escape" && d.hasAttribute("data-esc-close") && !e.defaultPrevented) {
        e.preventDefault();
        const btn =
          d.querySelector('button[aria-label="Kapat"]') ||
          [...d.querySelectorAll("button")].find((b) => /^(İptal|Kapat|Geri Dön|Vazgeç|Tamam)$/i.test((b.innerText || "").trim()));
        (btn || d).click();
        return;
      }
      if (e.key === "Tab") {
        const f = visibleFocusables(d);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (!d.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      mo.disconnect();
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
