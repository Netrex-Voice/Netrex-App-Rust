(() => {
  // Görünür, etkileşimli öğeleri listeler: adı, rolü, konumu; adsız / üstü kapalı / görünmez olanları işaretler.
  const out = [];
  const sel = 'button,[role=button],a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  document.querySelectorAll(sel).forEach((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    if (r.width < 4 || r.height < 4 || cs.visibility === "hidden" || cs.display === "none") return;
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const covered = !(hit === e || e.contains(hit) || (hit && hit.contains(e)));
    let o = 1;
    for (let n = e; n && n !== document.body; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    const raw = e.getAttribute("aria-label") || e.getAttribute("title") || e.innerText || e.getAttribute("placeholder") || "";
    const name = raw.trim().split(/[ \t\r\n]+/).join(" ").slice(0, 28);
    out.push(
      (name || "<ADSIZ>") + " | " + e.tagName.toLowerCase() + " | " + Math.round(r.x) + "," + Math.round(r.y) + " " +
        Math.round(r.width) + "x" + Math.round(r.height) + (covered ? " | ÜSTÜ KAPALI" : "") + (o < 0.05 ? " | GÖRÜNMEZ(opacity)" : "")
    );
  });
  return out.join("\n");
})()
