"use client";

/**
 * 🔔 Toast - Toast Notification Component
 * NDS v2.0 - Netrex Design System
 */

import { useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export default function Toast({
  id,
  type = "info",
  title,
  message,
  duration = 5000,
  onClose,
  className = "",
}) {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const typeConfig = {
    success: { icon: CheckCircle, color: "text-nds-success", bg: "bg-nds-success/10", border: "border-nds-success/30" },
    error: { icon: AlertCircle, color: "text-nds-danger", bg: "bg-nds-danger/10", border: "border-nds-danger/30" },
    warning: { icon: AlertTriangle, color: "text-nds-warning", bg: "bg-nds-warning/10", border: "border-nds-warning/30" },
    info: { icon: Info, color: "text-nds-info", bg: "bg-nds-info/10", border: "border-nds-info/30" },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={`
      flex items-start gap-3 p-4 rounded-xl border
      glass-strong shadow-nds-elevated animate-nds-slide-in
      ${config.bg} ${config.border} ${className}
    `}>
      <Icon size={20} className={config.color} />
      
      <div className="flex-1 min-w-0">
        {title && <h4 className="text-body font-semibold text-nds-text-primary mb-0.5">{title}</h4>}
        {message && <p className="text-small text-nds-text-secondary">{message}</p>}
      </div>

      {onClose && (
        <button onClick={() => onClose(id)} className="p-1 rounded hover:bg-white/10 text-nds-text-muted hover:text-nds-text-primary transition-colors">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * 🔔 ToastContainer - Container for stacking toasts
 */
export function ToastContainer({ toasts = [], onClose, position = "bottom-right" }) {
  const positionStyles = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  return (
    <div className={`fixed ${positionStyles[position]} z-[400] flex flex-col gap-2 max-w-sm w-full pointer-events-none`}>
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}
