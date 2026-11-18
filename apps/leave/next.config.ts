import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean),
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
    rules: { "globals.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
};

export default config;
