import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  // Reports read Trebuchet MS from assets/fonts at runtime; without this the
  // files are left out of the traced server bundle and reports silently fall
  // back to Helvetica in production.
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
