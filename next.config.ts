import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  /** Cache le pastille « N » Next.js en bas de l’écran (dev). */
  devIndicators: false,
};

export default nextConfig;
