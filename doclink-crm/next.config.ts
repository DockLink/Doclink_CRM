import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

loadEnv({ path: path.resolve(process.cwd(), "../.env") });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
