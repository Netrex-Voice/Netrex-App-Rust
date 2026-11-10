"use client";

/**
 * ⏳ Spinner - Loading Spinner Component
 * NDS v2.0 - Netrex Design System
 * 
 * Features: sizes, variants, full page loading
 */

import { Loader2, Radio } from "lucide-react";

export default function Spinner({
  size = "md",
  variant = "default",
  label,
  className = "",
}) {
  // Size configurations
  const sizeConfig = {
    xs: { icon: 14, text: "text-[10px]" },
    sm: { icon: 16, text: "text-caption" },
    md: { icon: 24, text: "text-small" },
    lg: { icon: 32, text: "text-body" },
    xl: { icon: 48, text: "text-h4" },
  };

  const config = sizeConfig[size];

  // Variant styles
  const variantStyles = {
    default: "text-nds-accent-primary",
    white: "text-white",
    muted: "text-nds-text-muted",
    success: "text-nds-success",
    danger: "text-nds-danger",
  };

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <Loader2
        size={config.icon}
        className={`
          animate-spin
          ${variantStyles[variant]}
        `}
      />
      {label && (
        <span className={`${config.text} text-nds-text-muted font-medium`}>
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * 📄 PageLoader - Full page loading overlay
 */
export function PageLoader({
  message = "Yükleniyor...",
  showLogo = true,
  className = "",
}) {
  return (
    <div
      className={`
        fixed inset-0 z-50
        flex flex-col items-center justify-center
        bg-nds-bg-primary
        ${className}
      `}
    >
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="decoration-circle-indigo w-96 h-96 top-1/4 left-1/4 opacity-30" />
        <div className="decoration-circle-purple w-96 h-96 bottom-1/4 right-1/4 opacity-20" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center animate-nds-fade-in">
        {showLogo && (
          <div className="mb-8">
            <div className="
              w-20 h-20
              glass-card
              rounded-2xl
              flex items-center justify-center
            ">
              <Radio
                size={40}
                className="text-nds-accent-primary animate-pulse"
              />
            </div>
          </div>
        )}

        <Spinner size="lg" />

        {message && (
          <p className="mt-4 text-body text-nds-text-tertiary">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 🔄 ContentLoader - Inline content loading placeholder
 */
export function ContentLoader({
  width = "100%",
  height = "20px",
  rounded = "md",
  className = "",
}) {
  const roundedStyles = {
    none: "rounded-none",
    sm: "rounded",
    md: "rounded-lg",
    lg: "rounded-xl",
    full: "rounded-full",
  };

  return (
    <div
      className={`
        bg-nds-glass-light
        animate-pulse
        ${roundedStyles[rounded]}
        ${className}
      `}
      style={{ width, height }}
    />
  );
}

/**
 * ⏳ SkeletonCard - Card-shaped loading placeholder
 */
export function SkeletonCard({ className = "" }) {
  return (
    <div className={`p-4 rounded-xl bg-nds-bg-secondary space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <ContentLoader width="40px" height="40px" rounded="lg" />
        <div className="flex-1 space-y-2">
          <ContentLoader width="60%" height="14px" />
          <ContentLoader width="40%" height="12px" />
        </div>
      </div>
      <ContentLoader width="100%" height="60px" />
      <div className="flex gap-2">
        <ContentLoader width="80px" height="32px" />
        <ContentLoader width="80px" height="32px" />
      </div>
    </div>
  );
}

/**
 * 📋 SkeletonList - List of skeleton items
 */
export function SkeletonList({ count = 3, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <ContentLoader width="32px" height="32px" rounded="lg" />
          <ContentLoader width="60%" height="14px" />
        </div>
      ))}
    </div>
  );
}
