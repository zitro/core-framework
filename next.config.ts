import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // v2.2 IA: capture/orient/refine/execute renames
      { source: "/sources", destination: "/capture", permanent: false },
      { source: "/sources/:path*", destination: "/capture/:path*", permanent: false },
      { source: "/synthesis", destination: "/refine", permanent: false },
      { source: "/synthesis/:path*", destination: "/refine/:path*", permanent: false },
      { source: "/artifacts", destination: "/execute", permanent: false },
      { source: "/artifacts/:path*", destination: "/execute/:path*", permanent: false },
      { source: "/reports", destination: "/execute?view=reports", permanent: false },
      // v2.1 IA collapse: legacy routes -> new homes
      { source: "/connectors", destination: "/capture?tab=connectors", permanent: false },
      { source: "/company", destination: "/capture?tab=company", permanent: false },
      { source: "/search", destination: "/capture?tab=web", permanent: false },
      { source: "/evidence", destination: "/capture?tab=evidence", permanent: false },
      { source: "/narrative", destination: "/execute?view=reports", permanent: false },
      { source: "/context", destination: "/settings?tab=engagement", permanent: false },
      { source: "/reviews", destination: "/settings?tab=reviews", permanent: false },
      { source: "/m365", destination: "/settings?tab=connections", permanent: false },
    ];
  },
};

export default nextConfig;
