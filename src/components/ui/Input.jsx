"use client";

/**
 * 📝 Input - Text Input Component
 * NDS v2.0 - Netrex Design System
 * 
 * Features: focus glow, icons, error state, sizes
 */

import { forwardRef, useState } from "react";
import { Eye, EyeOff, Search, X } from "lucide-react";

const Input = forwardRef(function Input({
  type = "text",
  size = "md",
  error = false,
  errorMessage,
  leftIcon,
  rightIcon,
  clearable = false,
  onClear,
  className = "",
  containerClassName = "",
  ...props
}, ref) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  // Size styles
  const sizeStyles = {
    sm: "h-9 px-3 text-small rounded-lg",
    md: "h-11 px-3.5 text-body rounded-xl",
    lg: "h-12 px-4 text-body rounded-xl",
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <div className={`relative ${containerClassName}`}>
      {/* Input Container */}
      <div className="relative">
        {/* Left Icon */}
        {leftIcon && (
          <div className={`
            absolute left-3 top-1/2 -translate-y-1/2
            text-nds-text-muted
            pointer-events-none
          `}>
            {leftIcon}
          </div>
        )}

        {/* Input Element */}
        <input
          ref={ref}
          type={inputType}
          className={`
            w-full
            bg-black/20
            text-nds-text-primary
            placeholder:text-nds-text-muted
            border
            outline-none
            transition-all duration-normal
            
            ${error 
              ? "border-nds-danger focus:border-nds-danger focus:shadow-nds-glow-red" 
              : "border-nds-border-light focus:border-nds-border-glow focus:shadow-nds-glow"
            }
            
            ${sizeStyles[size]}
            
            ${leftIcon ? "pl-10" : ""}
            ${rightIcon || isPassword || clearable ? "pr-10" : ""}
            
            ${className}
          `}
          {...props}
        />

        {/* Right Side Icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Clear Button */}
          {clearable && props.value && (
            <button
              type="button"
              onClick={onClear}
              className="
                p-1 rounded
                text-nds-text-muted
                hover:text-nds-text-primary
                hover:bg-white/5
                transition-all duration-fast
              "
            >
              <X size={iconSizes[size]} />
            </button>
          )}

          {/* Password Toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="
                p-1 rounded
                text-nds-text-muted
                hover:text-nds-text-primary
                hover:bg-white/5
                transition-all duration-fast
              "
            >
              {showPassword 
                ? <EyeOff size={iconSizes[size]} /> 
                : <Eye size={iconSizes[size]} />
              }
            </button>
          )}

          {/* Custom Right Icon */}
          {rightIcon && !isPassword && !clearable && (
            <span className="text-nds-text-muted">{rightIcon}</span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && errorMessage && (
        <p className="mt-1.5 text-caption text-nds-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
});

export default Input;

/**
 * 🔍 SearchInput - Pre-configured search input
 */
export const SearchInput = forwardRef(function SearchInput({
  placeholder = "Ara...",
  ...props
}, ref) {
  return (
    <Input
      ref={ref}
      type="text"
      placeholder={placeholder}
      leftIcon={<Search size={16} />}
      clearable
      {...props}
    />
  );
});

/**
 * 📝 TextArea - Multi-line text input
 */
export const TextArea = forwardRef(function TextArea({
  error = false,
  errorMessage,
  className = "",
  rows = 4,
  ...props
}, ref) {
  return (
    <div>
      <textarea
        ref={ref}
        rows={rows}
        className={`
          w-full
          bg-black/20
          text-nds-text-primary
          placeholder:text-nds-text-muted
          border rounded-xl
          p-3.5
          outline-none
          resize-none
          transition-all duration-normal
          
          ${error 
            ? "border-nds-danger focus:border-nds-danger focus:shadow-nds-glow-red" 
            : "border-nds-border-light focus:border-nds-border-glow focus:shadow-nds-glow"
          }
          
          ${className}
        `}
        {...props}
      />
      
      {error && errorMessage && (
        <p className="mt-1.5 text-caption text-nds-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
});
