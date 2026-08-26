import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jagnuvrqwxmbogjrjbis.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "coverartarchive.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.discogs.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;