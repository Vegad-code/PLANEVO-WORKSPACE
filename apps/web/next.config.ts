import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@planevo/core", "@planevo/api"],
  experimental: {
    optimizePackageImports: ["iconoir-react"],
  },
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
