import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [      {
        protocol: "https",
        hostname: "avbzvubfomtxbmooceal.supabase.co",
        pathname: "/**", 
      },], 
    // Add any external domains you need here
  },
};

export default nextConfig;
