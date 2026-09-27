import type { NextConfig } from "next";
const config: NextConfig = {
  output: process.env.SITES_STATIC_EXPORT === "1" ? "export" : undefined,
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  devIndicators: false,
};
export default config;
