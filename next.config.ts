import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Permite subir evidencias de hasta 10 MB vía Server Actions (default: 1 MB).
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
