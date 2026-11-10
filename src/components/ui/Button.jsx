"use client";

/**
 * 🔘 Button - Multi-variant Button Component
 * NDS v2.0 - Netrex Design System
 * 
 * Variants: primary, secondary, danger, ghost, icon
 * Sizes: sm, md, lg
 * Features: loading state, icons, full width
 */

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const Button = forwardRef(function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = "",
  ...props
}, ref) {
  
  // Base styles
  const baseStyles = `
    inline-flex items-center justify-center
    font-semibold
    transition-all duration-normal
    select-none
    relative overflow-hidden
    focus:outline-none focus-visible:ring-2 focus-visible:ring-nds-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-nds-bg-primary
    disabled:cursor-not-allowed disabled:opacity-50
    active:scale-[0.98]
  `;

  // Variant styles
  const variantStyles = {
    primary: `
      bg-nds-gradient-primary
      text-white
      hover:shadow-nds-glow
      hover:scale-[1.02]
      border-0
    `,
    secondary: `
      bg-nds-glass-light
      text-nds-text-primary
      border border-nds-border-light
      hover:bg-white/10
      hover:border-nds-border-medium
    `,
    danger: `
      bg-nds-danger
      text-white
      hover:bg-nds-danger-hover
      hover:shadow-nds-glow-red
      hover:scale-[1.02]
      border-0
    `,
    success: `
      bg-nds-success
      text-white
      hover:bg-nds-success-hover
      hover:shadow-nds-glow-green
      hover:scale-[1.02]
      border-0
    `,
    ghost: `
      bg-transparent
      text-nds-text-tertiary
      hover:text-nds-text-primary
      hover:bg-nds-glass-light
      border-0
    `,
    icon: `
      bg-transparent
      text-nds-text-tertiary
      hover:text-nds-text-primary
      hover:bg-nds-glass-light
      border-0
      !p-0
    `,
  };

  // Size styles
  const sizeStyles = {
    sm: variant === "icon" 
      ? "w-8 h-8 rounded-lg" 
      : "px-4 py-2 text-small rounded-lg gap-1.5",
    md: variant === "icon" 
      ? "w-10 h-10 rounded-lg" 
      : "px-6 py-3 text-body rounded-xl gap-2",
    lg: variant === "icon" 
      ? "w-12 h-12 rounded-xl" 
      : "px-8 py-3.5 text-body rounded-xl gap-2.5",
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    >
      {/* Loading Spinner */}
      {loading && (
        <Loader2 
          size={size === "sm" ? 14 : size === "lg" ? 20 : 16} 
          className="animate-spin mr-2" 
        />
      )}

      {/* Left Icon */}
      {!loading && leftIcon && (
        <span className="flex-shrink-0">{leftIcon}</span>
      )}

      {/* Content */}
      {children && (
        <span className={`inline-flex items-center ${loading ? "opacity-70" : ""}`}>{children}</span>
      )}

      {/* Right Icon */}
      {rightIcon && (
        <span className="flex-shrink-0">{rightIcon}</span>
      )}
    </button>
  );
});

export default Button;

/**
 * 🔘 IconButton - Shorthand for icon-only buttons
 */
export const IconButton = forwardRef(function IconButton({
  icon,
  size = "md",
  tooltip,
  ...props
}, ref) {
  return (
    <Button
      ref={ref}
      variant="icon"
      size={size}
      title={tooltip}
      {...props}
    >
      {icon}
    </Button>
  );
});
