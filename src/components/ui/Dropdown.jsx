"use client";

/**
 * 📋 Dropdown - Dropdown Menu Component
 * NDS v2.0 - Netrex Design System
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export default function Dropdown({
  trigger,
  items = [],
  value,
  onChange,
  placeholder = "Seçiniz",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedItem = items.find(item => item.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger */}
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full flex items-center justify-between px-4 py-3
            bg-black/20 border border-nds-border-light rounded-xl
            text-body transition-all duration-normal
            ${isOpen ? "border-nds-border-glow shadow-nds-glow" : "hover:border-nds-border-medium"}
          `}
        >
          <span className={selectedItem ? "text-nds-text-primary" : "text-nds-text-muted"}>
            {selectedItem?.label || placeholder}
          </span>
          <ChevronDown size={16} className={`text-nds-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 py-1 rounded-xl glass-strong border border-nds-border-light shadow-nds-elevated animate-nds-scale-in">
          {items.map((item) => (
            <button
              key={item.value}
              onClick={() => { onChange?.(item.value); setIsOpen(false); }}
              disabled={item.disabled}
              className={`
                w-full flex items-center gap-2 px-4 py-2.5 text-left text-body
                transition-colors duration-fast
                ${value === item.value ? "text-nds-accent-primary bg-nds-accent-primary/10" : "text-nds-text-secondary hover:bg-white/5 hover:text-nds-text-primary"}
                ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              {item.icon && <span className="w-5">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {value === item.value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
