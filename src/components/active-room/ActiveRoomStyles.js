
export const styleInjection = `
  /* ✅ CPU OPT: Minimal animasyonlar - sadece opacity (GPU-composited) */
  @keyframes pulse-opacity { 
    0%, 100% { opacity: 0.8; } 
    50% { opacity: 0.4; } 
  }
  
  /* ✅ CPU OPT: pulse-border sadeleştirildi - boxShadow yerine border-opacity */
  @keyframes pulse-border {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  /* ✅ CPU OPT: pulse-glow hafifletildi - daha az yoğun, daha az CPU kullanımı */
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.2; }
  }

  /* ✅ CPU OPT: speaking-avatar sadece opacity transition (all → opacity) */
  .speaking-avatar { 
    transition: opacity 0.2s ease-out; 
  }
  
  .volume-slider { -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; }
  .volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; cursor: pointer; }
`;
