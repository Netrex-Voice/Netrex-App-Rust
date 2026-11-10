"use client";

/**
 * 🛠️ InstallUpdateSplash - Graceful Update Installation Screen
 * NDS v6.1 - High-End Aesthetic
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Sparkles, Zap } from "lucide-react";

export default function InstallUpdateSplash() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100000] bg-[#0a0a0f] flex flex-col items-center justify-center overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none">

        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Animated Icon Container */}
        <div className="relative mb-12">
           <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-150 animate-pulse"></div>
           <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#1e1f22] to-[#0a0a0f] border border-white/10 flex items-center justify-center shadow-2xl">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw size={40} className="text-indigo-400" />
              </motion.div>
              
              {/* Floating Sparks */}
              <motion.div 
                animate={{ y: [0, -10, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="absolute -top-4 -right-4 text-emerald-400"
              >
                <Sparkles size={20} />
              </motion.div>
              <motion.div 
                animate={{ y: [0, -15, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                className="absolute -bottom-2 -left-6 text-yellow-400"
              >
                <Zap size={18} />
              </motion.div>
           </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
             Netrex Güncelleniyor<span className="w-12 text-left">{dots}</span>
          </h1>
          <p className="text-[#949ba4] font-medium text-lg max-w-sm">
            Yeni özellikler hazırlanıyor, hemen dönüyoruz. Lütfen kapatmayın.
          </p>
        </div>

        {/* Interactive Progress Bar */}
        <div className="mt-12 w-64 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
           <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
           />
        </div>

        {/* Brand Tag */}
        <div className="mt-24 opacity-30 flex items-center gap-2">
           <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
              <span className="text-black font-black text-[10px]">N</span>
           </div>
           <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Netrex Client</span>
        </div>
      </motion.div>

      {/* CSS Effects */}
      <style jsx>{`
        .bg-grid {
          background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0);
          background-size: 24px 24px;
        }
      `}</style>
    </div>
  );
}
