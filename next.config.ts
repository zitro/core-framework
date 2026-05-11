import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    // Phase 7 IA refactor: the standalone tool pages moved into Capture's
    // Discover tab and Orchestrate's Grounded tab. Keep these redirects so
    // bookmarks and any in-app links don't 404.
    return [
      { source: "/context", destination: "/capture?tab=sources", permanent: true },
      { source: "/search", destination: "/capture?tab=discover", permanent: true },
      { source: "/m365", destination: "/capture?tab=discover", permanent: true },
      { source: "/company", destination: "/capture?tab=discover", permanent: true },
      { source: "/grounding", destination: "/orchestrate?tab=grounded", permanent: true },
    ];
  },
};

export default nextConfig;
