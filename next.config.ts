import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@prospectdyno/ai",
    "@prospectdyno/engine",
    "@prospectdyno/shared",
    "@prospectdyno/supabase",
  ],
};

export default nextConfig;
