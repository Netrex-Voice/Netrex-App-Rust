"use client";

/**
 * 💬 Tooltip - Tooltip Component
 * NDS v2.0 - Netrex Design System
 * 
 * Features: positions, sizes, delay
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export default function Tooltip({
  children,
  content,
  position = "top",
  delay = 300,
  disabled = false,
  className = "",
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let top, left;

    switch (position) {
      case "top":
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "left":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - gap;
        break;
      case "right":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + gap;
        break;
      default:
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    }

    // Keep tooltip within viewport
    const padding = 8;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

    setCoords({ top, left });
  }, [position]);

  const showTooltip = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      // 🚀 OPTIMIZATION: passive flag eklendi
      window.addEventListener("scroll", updatePosition, { capture: true, passive: true });
      window.addEventListener("resize", updatePosition, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isVisible, updatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!content) return children;

  return (
    <>
      {/* Trigger */}
      <span
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-flex"
      >
        {children}
      </span>

      {/* Tooltip Portal */}
      {isVisible && typeof document !== "undefined" && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            zIndex: 9999,
          }}
          className={`
            px-3 py-2
            rounded-lg
            bg-nds-bg-elevated
            text-nds-text-primary
            text-caption font-medium
            shadow-nds-elevated
            border border-nds-border-light
            pointer-events-none
            animate-nds-fade-in
            max-w-xs
            ${className}
          `}
        >
          {content}

          {/* Arrow */}
          <span
            className={`
              absolute w-2 h-2
              bg-nds-bg-elevated
              border-nds-border-light
              rotate-45
              
              ${position === "top" ? "bottom-[-5px] left-1/2 -translate-x-1/2 border-r border-b" : ""}
              ${position === "bottom" ? "top-[-5px] left-1/2 -translate-x-1/2 border-l border-t" : ""}
              ${position === "left" ? "right-[-5px] top-1/2 -translate-y-1/2 border-t border-r" : ""}
              ${position === "right" ? "left-[-5px] top-1/2 -translate-y-1/2 border-b border-l" : ""}
            `}
          />
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * 💡 TooltipSimple - Simple title-based tooltip
 */
export function TooltipSimple({ children, content, ...props }) {
  return (
    <span title={content} {...props}>
      {children}
    </span>
  );
}
