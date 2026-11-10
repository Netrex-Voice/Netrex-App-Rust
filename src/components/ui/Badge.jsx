"use client";

/**
 * 🔴 Badge - Notification Badge/Dot Component
 * NDS v2.0 - Netrex Design System
 * 
 * Features: dot, count, variants, positioning
 */

import { forwardRef } from "react";

const Badge = forwardRef(function Badge({
  children,
  variant = "default",
  size = "md",
  count,
  dot = false,
  max = 99,
  showZero = false,
  className = "",
  ...props
}, ref) {
  
  // Don't show if count is 0 and showZero is false
  const shouldShow = dot || showZero || count > 0;
  if (!shouldShow) return null;

  // Variant styles
  const variantStyles = {
    default: "bg-nds-accent-primary",
    success: "bg-nds-success",
    danger: "bg-nds-danger",
    warning: "bg-nds-warning",
    info: "bg-nds-info",
  };

  // Size styles
  const sizeStyles = dot ? {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  } : {
    sm: "min-w-[16px] h-4 px-1 text-[10px]",
    md: "min-w-[18px] h-[18px] px-1.5 text-[11px]",
    lg: "min-w-[22px] h-[22px] px-2 text-caption",
  };

  const displayCount = count > max ? `${max}+` : count;

  return (
    <span
      ref={ref}
      className={`
        inline-flex items-center justify-center
        rounded-full
        font-bold
        text-white
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {!dot && displayCount}
    </span>
  );
});

export default Badge;

/**
 * 📛 BadgeWrapper - Wrapper to position badge on any element
 */
export function BadgeWrapper({
  children,
  badge,
  position = "top-right",
  offset = "sm",
  className = "",
}) {
  const positionStyles = {
    "top-right": "top-0 right-0",
    "top-left": "top-0 left-0",
    "bottom-right": "bottom-0 right-0",
    "bottom-left": "bottom-0 left-0",
  };

  const offsetStyles = {
    none: "",
    sm: "-translate-y-1/3 translate-x-1/3",
    md: "-translate-y-1/2 translate-x-1/2",
  };

  const transformStyles = {
    "top-right": offsetStyles[offset],
    "top-left": offset !== "none" ? "-translate-y-1/3 -translate-x-1/3" : "",
    "bottom-right": offset !== "none" ? "translate-y-1/3 translate-x-1/3" : "",
    "bottom-left": offset !== "none" ? "translate-y-1/3 -translate-x-1/3" : "",
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      {children}
      {badge && (
        <span 
          className={`
            absolute
            ${positionStyles[position]}
            ${transformStyles[position]}
          `}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/**
 * 🏷️ StatusBadge - Text-based status badge
 */
export function StatusBadge({
  status = "online",
  showLabel = true,
  size = "md",
  className = "",
}) {
  const statusConfig = {
    online: { color: "bg-nds-success", label: "Çevrimiçi" },
    offline: { color: "bg-nds-offline", label: "Çevrimdışı" },
    idle: { color: "bg-nds-warning", label: "Boşta" },
    dnd: { color: "bg-nds-danger", label: "Rahatsız Etmeyin" },
    invisible: { color: "bg-nds-invisible", label: "Görünmez" },
  };

  const config = statusConfig[status] || statusConfig.offline;

  const sizeStyles = {
    sm: "text-[10px] gap-1",
    md: "text-caption gap-1.5",
    lg: "text-small gap-2",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  return (
    <span 
      className={`
        inline-flex items-center
        ${sizeStyles[size]}
        ${className}
      `}
    >
      <span 
        className={`
          ${dotSizes[size]}
          rounded-full
          ${config.color}
        `}
      />
      {showLabel && (
        <span className="text-nds-text-tertiary font-medium">
          {config.label}
        </span>
      )}
    </span>
  );
}
