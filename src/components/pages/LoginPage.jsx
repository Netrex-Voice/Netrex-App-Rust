"use client";

/**
 * 🔐 LoginPage - Ultra Premium Login Screen
 * NDS v2.0 - Netrex Design System
 * 
 * Features:
 * - Animated background with floating particles
 * - Premium glassmorphism design
 * - Google OAuth & Anonymous login
 * - Fully responsive (mobile-first)
 * - Staggered entrance animations
 */

import { useState, useEffect } from "react";
import { Sparkles, Shield, Users, Zap, Radio, ArrowRight, Eye, EyeOff, User } from "lucide-react";
import { toast } from "@/src/utils/toast";
import { useAuthStore } from "@/src/store/authStore";

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Feature items with colors
const FEATURES = [
  { icon: Shield, label: "Güvenli", color: "from-green-400 to-emerald-500" },
  { icon: Users, label: "Açık Kaynak", color: "from-blue-400 to-cyan-500" },
  { icon: Zap, label: "Hızlı", color: "from-amber-400 to-orange-500" },
];

export default function LoginPage({
  onGoogleLogin,
  onAnonymousLogin,
  isLoading = false,
}) {
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGoogleLogin = () => {
    if (typeof window !== "undefined" && window.netrex) {
      // Electron: OAuth IPC flow
      onGoogleLogin?.();
    } else {
      // Web: Firebase signInWithPopup
      const { loginWithGooglePopup } = useAuthStore.getState();
      loginWithGooglePopup();
    }
  };

  const handleAnonLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("Lütfen bir kullanıcı adı girin.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onAnonymousLogin?.(username.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0c] flex items-center justify-center text-white select-none relative overflow-hidden p-4">
      
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] sm:bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_20%,transparent_100%)]" />
        
        {/* Floating Particles */}
        <div className="absolute top-[10%] left-[20%] w-2 h-2 bg-indigo-400/40 rounded-full animate-float" />
        <div className="absolute top-[30%] right-[15%] w-1.5 h-1.5 bg-purple-400/40 rounded-full animate-float-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[20%] left-[30%] w-2 h-2 bg-cyan-400/40 rounded-full animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[60%] right-[25%] w-1 h-1 bg-pink-400/40 rounded-full animate-float-slow" style={{ animationDelay: '3s' }} />
        <div className="absolute bottom-[40%] left-[15%] w-1.5 h-1.5 bg-amber-400/40 rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Main Content Container */}
      <div className={`relative z-10 w-full max-w-[420px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Login Card */}
        <div className="relative">
          {/* Card Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-[32px] blur-xl opacity-60" />
          
          {/* Card */}
          <div className="relative bg-gradient-to-br from-[#1a1b1e]/95 via-[#16171a]/95 to-[#111214]/95 backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden">
            
            {/* Top Glow Line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            
            {/* Inner Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
            
            {/* Content */}
            <div className="relative z-10 p-6 sm:p-8 lg:p-10">
              
              {/* Logo Section */}
              <div className="text-center mb-8 sm:mb-10">
                {/* Logo Container with Glow */}
                <div className="relative inline-block mb-6 group">
                  {/* Glow ring */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl sm:rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 scale-110" />
                  
                  {/* Logo box */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_20px_50px_rgba(99,102,241,0.4)] group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                    {/* Inner shine */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                    
                    <img 
                      src="logo.png" 
                      alt="Netrex Logo" 
                      className="relative w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-lg"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'block';
                      }}
                    />
                    <span className="text-white font-bold text-3xl sm:text-4xl hidden">N</span>
                  </div>
                  
                  {/* Sparkle decorations */}
                  <Sparkles size={14} className="absolute -top-1 -right-1 text-yellow-400/70 animate-pulse" />
                  <Sparkles size={10} className="absolute -bottom-1 -left-1 text-cyan-400/70 animate-pulse" style={{ animationDelay: '0.5s' }} />
                </div>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent mb-2">
                  Netrex
                </h1>

                {/* Subtitle */}
                <p className="text-sm sm:text-base text-[#5c5e66]">
                  Güvenli Sesli Sohbet Platformu
                </p>
              </div>

              {/* Google Login Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="group w-full flex items-center justify-center gap-3 px-6 py-3.5 sm:py-4 bg-white text-gray-800 font-semibold rounded-xl sm:rounded-2xl transition-all duration-300 mb-6 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_10px_40px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <GoogleIcon />
                <span className="text-sm sm:text-base">Google ile Giriş Yap</span>
                <ArrowRight size={18} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
              </button>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 py-1.5 bg-[#16171a] text-[#5c5e66] text-xs sm:text-sm rounded-full border border-white/5">
                    veya
                  </span>
                </div>
              </div>

              {/* Anonymous Login Form */}
              <form onSubmit={handleAnonLogin} className="space-y-4">
                {/* Username Input */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl sm:rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center">
                    <div className="absolute left-4 text-[#5c5e66] group-focus-within:text-indigo-400 transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      placeholder="Kullanıcı Adı"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading || isSubmitting}
                      className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-[#1e1f22] border border-white/10 rounded-xl sm:rounded-2xl text-white placeholder-[#5c5e66] text-sm sm:text-base outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || isSubmitting || !username.trim()}
                  className="group w-full flex items-center justify-center gap-2 px-6 py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl sm:rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_10px_40px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span className="text-sm sm:text-base">Anonim Giriş</span>
                    </>
                  )}
                </button>
              </form>

              {/* Features */}
              <div className="mt-8 sm:mt-10 pt-6 border-t border-white/5">
                <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                  {FEATURES.map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 px-2 py-1 sm:px-4 sm:py-2 rounded-full bg-white/5 border border-white/5 hover:border-white/20 transition-all duration-200 group"
                    >
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-gradient-to-br ${feature.color} flex items-center justify-center`}>
                        <feature.icon size={12} className="text-white" />
                      </div>
                      <span className="text-[10px] sm:text-xs text-[#949ba4] group-hover:text-white transition-colors">
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Version Footer */}
        <div className="text-center mt-6 sm:mt-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-xs text-[#5c5e66] font-medium">Netrex Client</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
              v{process.env.NEXT_PUBLIC_APP_VERSION || "8.0.0"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
