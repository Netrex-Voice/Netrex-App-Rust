// POST /api/cloudinary-delete   gövde: { public_id }   başlık: Authorization: Bearer <Firebase ID token>
// Yanıt: { success: true, result: <Cloudinary yanıtı> }

import { v2 as cloudinary } from "cloudinary";
import { allowMethods, cors, jsonBody, requireUser, validPublicId } from "../lib/common.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!allowMethods(req, res, ["POST"])) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const publicId = jsonBody(req).public_id;
  if (!validPublicId(publicId)) return res.status(400).json({ error: "invalid public_id" });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ error: "Cloudinary not configured" });
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return res.status(200).json({ success: true, result });
  } catch (e) {
    console.error("Cloudinary silme hatası:", e && e.message);
    return res.status(502).json({ error: "delete failed" });
  }
}
