"use client";

import { useMaybeRoomContext } from "@livekit/components-react";

export function useOptionalRoomContext() {
  try {
    return useMaybeRoomContext() || null;
  } catch (e) {
    return null;
  }
}
