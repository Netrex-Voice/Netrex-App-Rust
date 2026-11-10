"use client";

import { forwardRef } from "react";

const Sidebar = forwardRef(function Sidebar({ 
  header,
  children, 
  footer,
  className = "" 
}, ref) {
  return (
    <div 
      ref={ref}
      className={`
        sidebar-container
        h-full w-full
        flex flex-col
        bg-nds-bg-primary
        ${className}
      `}
    >
      {/* Sidebar Header */}
      {header && (
        <div className="
          sidebar-header
          h-14
          flex items-center
          px-4
          border-b border-nds-border-subtle
          flex-shrink-0
        ">
          {header}
        </div>
      )}

      {/* Sidebar Content - Scrollable */}
      <div className="
        sidebar-content
        flex-1
        overflow-y-auto
        overflow-x-hidden
        scrollbar-thin
      ">
        {children}
      </div>

      {/* Sidebar Footer - User Panel */}
      {footer && (
        <div className="
          sidebar-footer
          h-userpanel
          flex-shrink-0
          border-t border-nds-border-subtle
          bg-nds-bg-deep/50
        ">
          {footer}
        </div>
      )}
    </div>
  );
});

export default Sidebar;

/**
 * 📂 SidebarSection - A section within the sidebar
 */
export function SidebarSection({ 
  title, 
  children, 
  action,
  collapsed = false,
  onToggle,
  className = "" 
}) {
  return (
    <div className={`
      sidebar-section
      py-3
      ${className}
    `}>
      {/* Section Header */}
      {title && (
        <div className="
          flex items-center justify-between
          px-3 mb-1
          group
        ">
          <button 
            onClick={onToggle}
            className="
              flex items-center gap-1
              text-category
              hover:text-nds-text-secondary
              transition-colors duration-fast
            "
          >
            <span className={`
              transition-transform duration-normal
              ${collapsed ? '-rotate-90' : 'rotate-0'}
            `}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 3L5 6L8 3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </span>
            <span>{title}</span>
          </button>

          {/* Action button (e.g., add channel) */}
          {action && (
            <div className="
              opacity-0 group-hover:opacity-100
              transition-opacity duration-fast
            ">
              {action}
            </div>
          )}
        </div>
      )}

      {/* Section Content */}
      {!collapsed && (
        <div className="
          sidebar-section-content
          px-2
          space-y-0.5
        ">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * 🔊 SidebarItem - Individual item in the sidebar
 */
export function SidebarItem({ 
  icon, 
  label, 
  active = false, 
  unread = false,
  onClick,
  rightContent,
  className = "" 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        sidebar-item
        w-full
        flex items-center gap-2.5
        px-2.5 py-2
        rounded-lg
        text-left
        transition-colors duration-normal will-change-[background-color,color]
        relative
        group
        
        ${active 
          ? 'bg-white/[0.08] text-nds-text-primary' 
          : 'text-nds-text-tertiary hover:bg-white/[0.04] hover:text-nds-text-secondary'
        }
        
        ${className}
      `}
    >
      {/* Active Indicator */}
      {active && (
        <div className="
          absolute left-0 top-1/2 -translate-y-1/2
          w-1 h-5
          bg-white
          rounded-r-full
        " />
      )}

      {/* Unread Indicator */}
      {unread && !active && (
        <div className="
          absolute left-0 top-1/2 -translate-y-1/2
          w-1 h-2
          bg-nds-accent-primary
          rounded-r-full
        " />
      )}

      {/* Icon */}
      {icon && (
        <span className={`
          flex-shrink-0
          ${active ? 'text-nds-text-primary' : 'text-nds-text-tertiary group-hover:text-nds-text-secondary'}
          transition-colors duration-normal
        `}>
          {icon}
        </span>
      )}

      {/* Label */}
      <span className="
        flex-1
        text-small
        font-medium
        truncate
      ">
        {label}
      </span>

      {/* Right Content (e.g., user count, delete button) */}
      {rightContent && (
        <span className="
          flex-shrink-0
          opacity-0 group-hover:opacity-100
          transition-opacity duration-fast
        ">
          {rightContent}
        </span>
      )}
    </button>
  );
}
