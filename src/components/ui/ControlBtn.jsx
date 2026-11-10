/**
 * 🎛️ ControlBtn - Premium Kontrol Butonu
 */
function ControlBtn({ 
  isActive, 
  activeIcon, 
  inactiveIcon, 
  onClick, 
  label, 
  disabled = false, 
  variant = "default" // 'default', 'active', 'danger', 'success', 'secondary'
}) {
  
  // Stil Varyasyonları
  const styles = {
    // 1. Default (Genellikle Ses/Mikrofon için): Aktifse beyaz/gri, pasifse şeffaf
    default: isActive 
      ? "bg-[#2b2d31] text-white border-white/20 hover:border-white/40" 
      : "bg-white text-black border-transparent shadow-[0_0_15px_rgba(255,255,255,0.4)] hover:scale-105", // Buradaki mantık ters çalışabilir, isActive genelde 'Mute Değil' demek
    
    // 2. Danger (Kırmızı - Susturulmuş Durum):
    danger: "bg-red-500 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:bg-red-600",
    
    // 3. Active (Beyaz Parlak - Kamera Açık):
    active: "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.5)] hover:scale-105",

    // 4. Success (Yeşil - Ekran Paylaşımı):
    success: "bg-[#23a559] text-white border-green-400 shadow-[0_0_20px_rgba(35,165,89,0.4)] hover:bg-[#1b8746] hover:scale-105",

    // 5. Secondary (Kapalı Durum):
    secondary: "bg-white/5 text-[#949ba4] border-transparent hover:bg-white/10 hover:text-white"
  };

  // State'e göre doğru stili seçme mantığı
  let currentStyle = styles.secondary;

  if (disabled) {
    currentStyle = "opacity-40 cursor-not-allowed bg-white/5 text-[#5c5e66] border-transparent";
  } else if (variant === 'danger') {
    currentStyle = styles.danger;
  } else if (variant === 'active') {
    currentStyle = styles.active;
  } else if (variant === 'success') {
    currentStyle = styles.success;
  } else if (isActive && variant === 'default') {
    // Normal durumda (Mute değilse)
    currentStyle = "bg-[#2b2d31] text-[#dbdee1] border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20";
  } else if (!isActive && variant === 'default') {
     // Mute ise (Genellikle yukarıda danger ile handle edilir ama yedek)
     currentStyle = styles.secondary;
  } else if (isActive) {
    currentStyle = styles.active;
  }

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          w-11 h-11 sm:w-12 sm:h-12 
          flex items-center justify-center 
          rounded-2xl border
          transition-all duration-300 ease-out
          active:scale-90
          ${currentStyle}
        `}
      >
        <div className="relative z-10 transition-transform duration-300 group-hover:scale-110">
          {isActive ? activeIcon : inactiveIcon}
        </div>
      </button>

      {/* Tooltip (İsteğe bağlı - Hoverda üstte çıkar) */}
      {!disabled && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2 py-1 bg-black/90 text-[10px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 backdrop-blur-md">
          {label}
        </span>
      )}
    </div>
  );
}