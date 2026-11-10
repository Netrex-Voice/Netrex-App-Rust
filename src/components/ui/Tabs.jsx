"use client";

/**
 * 📑 Tabs - Tab Navigation Component
 * NDS v2.0 - Netrex Design System
 */

import { useState } from "react";

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  variant = "default",
  className = "",
}) {
  const variantStyles = {
    default: {
      container: "border-b border-nds-border-subtle",
      tab: "px-4 py-3 text-body font-medium transition-all duration-normal",
      active: "text-nds-accent-primary border-b-2 border-nds-accent-primary",
      inactive: "text-nds-text-tertiary hover:text-nds-text-secondary",
    },
    pills: {
      container: "p-1 rounded-xl bg-nds-bg-secondary inline-flex gap-1",
      tab: "px-4 py-2 rounded-lg text-small font-medium transition-all duration-normal",
      active: "bg-nds-accent-primary text-white shadow-nds-glow",
      inactive: "text-nds-text-tertiary hover:text-nds-text-primary hover:bg-white/5",
    },
    vertical: {
      container: "flex flex-col gap-1",
      tab: "px-4 py-2.5 rounded-lg text-body font-medium text-left transition-all duration-normal",
      active: "bg-white/[0.08] text-nds-text-primary border-l-2 border-nds-accent-primary",
      inactive: "text-nds-text-tertiary hover:bg-white/[0.04] hover:text-nds-text-secondary",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={`${styles.container} ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange?.(tab.id)}
          disabled={tab.disabled}
          className={`
            ${styles.tab}
            ${activeTab === tab.id ? styles.active : styles.inactive}
            ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <span className="flex items-center gap-2">
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-nds-accent-primary text-white">{tab.badge}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * 📑 TabPanel - Tab content panel
 */
export function TabPanel({ children, isActive, className = "" }) {
  if (!isActive) return null;
  return <div className={`animate-nds-fade-in ${className}`}>{children}</div>;
}

/**
 * 📑 TabsWithContent - Tabs with built-in content switching
 */
export function TabsWithContent({ tabs = [], defaultTab, variant = "default", className = "" }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const activeContent = tabs.find(t => t.id === activeTab)?.content;

  return (
    <div className={className}>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant={variant} />
      <div className="mt-4">{activeContent}</div>
    </div>
  );
}
