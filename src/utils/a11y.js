/**
 * Erişilebilirlik yardımcıları.
 *
 * `clickable`: fareyle tıklanan ama düğme olmayan öğeleri (div/li) klavye ve ekran okuyucuya açar.
 * Tab ile odaklanır, Enter / Boşluk ile tetiklenir, ekran okuyucu rolü ve adı bilir. İç içe düğmelerde
 * (ör. kanal satırı içindeki "sesli okuma" düğmesi) çakışma olmasın diye yalnızca öğenin KENDİSİNE
 * gelen tuşları işler.
 */
export function clickable(onClick, label, extra = {}) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.(e);
      }
    },
    ...extra,
  };
}

/** Yalnızca ekran okuyucuya görünen metin sınıfı (Tailwind `sr-only`) için sabit. */
export const SR_ONLY = "sr-only";
