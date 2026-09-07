import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@prospectdyno/ai",
    "@prospectdyno/engine",
    "@prospectdyno/shared",
    "@prospectdyno/supabase",
  ],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
