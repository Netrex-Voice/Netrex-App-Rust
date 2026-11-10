/** @type {import('next').NextConfig} */
const packageJson = require("./package.json");

// Tauri: statik export (out/) -> tauri:// protokolüyle sunulur.
// Web hedefi (NEXT_PUBLIC_BUILD_TARGET=web) sunucu modunda kalır.
const isWebTarget =
  process.env.NEXT_PUBLIC_BUILD_TARGET === "web" || !!process.env.VERCEL;

const nextConfig = {
  ...(isWebTarget ? {} : { output: "export" }),
  images: { unoptimized: true },
  trailingSlash: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  },
};

module.exports = nextConfig;
