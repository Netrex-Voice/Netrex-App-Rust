"use client";

import { useState, useEffect } from "react";

export default function GameDuration({ startTime }) {
  const [duration, setDuration] = useState("");

  useEffect(() => {
    if (!startTime) return;

    // Convert Firestore Timestamp to Date if needed
    const startDate = startTime.toDate ? startTime.toDate() : new Date(startTime);

    const updateDuration = () => {
      const now = new Date();
      let diff = now - startDate;
      
      // Saat farkı koruması
      if (diff < 0) diff = 0;
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        setDuration(`${hours} sa ${minutes} dk`);
      } else if (minutes > 0) {
        setDuration(`${minutes} dk`);
      } else {
        setDuration("Az önce");
      }
    };

    // Initial update
    updateDuration();

    // Update every minute (no need for second precision for game time usually)
    const interval = setInterval(updateDuration, 60000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (!duration) return null;

  const isJustNow = duration === "Az önce";

  return (
    <span className="text-[9px] mt-1 text-gray-400 font-normal hover:text-gray-300 opacity-100 duration-300">
      {duration} {isJustNow ? "" : "dır"}
    </span>
  );
}
