// GET /api/health: dağıtımın ayakta olduğunu ve ortam değişkenlerinin tanımlı olup olmadığını söyler (DEĞERLERİ değil).

import { loadServers } from "../lib/livekit.js";

export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    firebaseProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    livekitServers: loadServers().length,
    cloudinary: Boolean(
      (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    ),
  });
}
