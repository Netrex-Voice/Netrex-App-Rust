"use client";

import { forwardRef } from "react";

const MainContent = forwardRef(function MainContent({ 
  header,
  children, 
  footer,
  showBackgroundDecoration = true,
  className = "" 
}, ref) {
  return (
    <div 
      ref={ref}
      className={`
        main-content-container
        h-full w-full
        flex flex-col
        bg-nds-bg-tertiary
        relative
        overflow-hidden
        ${className}
      `}
    >
      {/* Background gradient - lightweight alternative to blurred circles */}
      {showBackgroundDecoration && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] via-transparent to-purple-500/[0.02]" />
        </div>
      )}

      {/* Header */}
      {header && (
        <div className="
          main-header
          h-14
          flex items-center
          px-4
          border-b border-nds-border-subtle
          bg-nds-bg-tertiary
          flex-shrink-0
          relative z-10
        ">
          {header}
        </div>
      )}

      {/* Content */}
      <div className="
        main-body
        flex-1
        overflow-hidden
        relative
      ">
        {children}
      </div>

      {/* Footer / Bottom Controls */}
      {footer && (
        <div className="
          main-footer
          h-controls
          flex-shrink-0
          border-t border-nds-border-subtle
          bg-nds-bg-secondary
          relative z-10
        ">
          {footer}
        </div>
      )}
    </div>
  );
});

export default MainContent;
