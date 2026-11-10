"use client";

/**
 * 📄 LoadingScreen - App Loading Screen
 * NDS v2.0 - Netrex Design System
 */

import { Radio } from "lucide-react";
import { Spinner } from "../ui";

export default function LoadingScreen({ message = "Yükleniyor..." }) {
  return (
    <div className="
      h-screen w-screen
      bg-nds-bg-primary
      flex flex-col items-center justify-center
      relative overflow-hidden
    ">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="decoration-circle-indigo w-96 h-96 top-1/4 left-1/4 opacity-30" />
        <div className="decoration-circle-purple w-96 h-96 bottom-1/4 right-1/4 opacity-20" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center animate-nds-fade-in">
        {/* Logo */}
        <div className="
          w-20 h-20
          glass-card
          rounded-2xl
          flex items-center justify-center
          mb-8
        ">
          <Radio size={40} className="text-nds-accent-primary animate-pulse" />
        </div>

        {/* Spinner */}
        <Spinner size="lg" />

        {/* Message */}
        <p className="mt-4 text-body text-nds-text-tertiary">
          {message}
        </p>
      </div>
    </div>
  );
}
