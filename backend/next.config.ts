import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module: must not be bundled.
  serverExternalPackages: ["better-sqlite3", "@ffmpeg-installer/ffmpeg"],
};

export default nextConfig;
