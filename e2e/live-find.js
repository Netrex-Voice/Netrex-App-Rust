// __SEL__ yerine aranan metin / css: seçici enjekte edilir. Öğenin ortasının koordinatını döndürür.
((s) => {
  let el;
  if (s.startsWith("css:")) {
    el = document.querySelector(s.slice(4));
  } else {
    const cands = [...document.querySelectorAll("button,[role=button],a,[tabindex],div,span,li,p,h1,h2,h3")].filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 3 || r.height < 3) return false;
      const label = e.getAttribute("aria-label") || "";
      const text = (e.innerText || "").trim();
      return label === s || text === s || text.split("\n")[0].trim() === s;
    });
    el = cands[cands.length - 1];
  }
  if (!el) return null;
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})(__SEL__)
