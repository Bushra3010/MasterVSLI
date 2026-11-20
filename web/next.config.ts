import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ERP pages are per-user and always dynamic; keep the classic request-time model.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Lets `next dev` read Cloudflare bindings (R2, env) declared in wrangler.jsonc.
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev()).catch(() => {});
