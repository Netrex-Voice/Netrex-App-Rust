"use client";

/**
 * 🔀 Toggle - Switch/Toggle Component
 * NDS v2.0 - Netrex Design System
 * 
 * Features: sizes, disabled state, glow effect when active
 */

import { forwardRef } from "react";

const Toggle = forwardRef(function Toggle({
  checked = false,
  onChange,
  size = "md",
  disabled = false,
  label,
  description,
  className = "",
  ...props
}, ref) {
  
  // Size configurations
  const sizeConfig = {
    sm: {
      track: "w-10 h-5",
      thumb: "w-4 h-4",
      translate: "translate-x-[18px]",
      dot: "w-1.5 h-1.5",
    },
    md: {
      track: "w-14 h-7",
      thumb: "w-6 h-6",
      translate: "translate-x-[26px]",
      dot: "w-2 h-2",
    },
    lg: {
      track: "w-16 h-8",
      thumb: "w-7 h-7",
      translate: "translate-x-[30px]",
      dot: "w-2.5 h-2.5",
    },
  };

  const config = sizeConfig[size];

  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {/* Toggle Track */}
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          ${config.track}
          rounded-full
          relative
          border-2
          transition-all duration-500
          flex-shrink-0
          focus:outline-none focus-visible:ring-2 focus-visible:ring-nds-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-nds-bg-primary
          
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          
          ${checked
            ? "bg-gradient-to-r from-green-500 to-green-600 border-green-400/50 shadow-[0_0_20px_rgba(34,197,94,0.5)]"
            : "bg-[#404249] border-nds-border-light hover:border-nds-border-medium"
          }
        `}
        {...props}
      >
        {/* Thumb */}
        <span
          className={`
            absolute top-0 left-[1px]
            ${config.thumb}
            bg-white
            rounded-full
            shadow-lg
            transition-all duration-500
            flex items-center justify-center
            
            ${checked ? config.translate : "translate-x-0"}
          `}
        >
          {/* Active Dot */}
          {checked && (
            <span 
              className={`
                ${config.dot}
                bg-green-500
                rounded-full
                animate-pulse
              `}
            />
          )}
        </span>
      </button>

      {/* Label & Description */}
      {(label || description) && (
        <div className="flex flex-col min-w-0">
          {label && (
            <span 
              className={`
                text-body font-medium
                ${disabled ? "text-nds-text-disabled" : "text-nds-text-primary"}
              `}
              onClick={handleClick}
            >
              {label}
            </span>
          )}
          {description && (
            <span className="text-caption text-nds-text-muted mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default Toggle;

/**
 * 📻 ToggleGroup - Group of toggle options
 */
export function ToggleGroup({
  options = [],
  value,
  onChange,
  className = "",
}) {
  return (
    <div className={`flex gap-1 p-1 rounded-xl bg-nds-bg-secondary ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange?.(option.value)}
          className={`
            flex-1 px-4 py-2
            rounded-lg
            text-small font-medium
            transition-all duration-normal
            
            ${value === option.value
              ? "bg-nds-accent-primary text-white shadow-nds-glow"
              : "text-nds-text-tertiary hover:text-nds-text-primary hover:bg-white/5"
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
