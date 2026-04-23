import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // v2.1 IA collapse: legacy routes -> new homes
      { source: "/connectors", destination: "/sources?tab=connectors", permanent: false },
      { source: "/company", destination: "/sources?tab=company", permanent: false },
      { source: "/search", destination: "/sources?tab=web", permanent: false },
      { source: "/evidence", destination: "/sources?tab=evidence", permanent: false },
      { source: "/narrative", destination: "/reports", permanent: false },
      { source: "/context", destination: "/settings?tab=engagement", permanent: false },
      { source: "/reviews", destination: "/settings?tab=reviews", permanent: false },
      { source: "/m365", destination: "/settings?tab=connections", permanent: false },
    ];
  },
};

export default nextConfig;
