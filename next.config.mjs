/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingExcludes: {
    "/*": ["./.data/**/*", "./.wrangler/**/*", "./.env*", "./.dev.vars*"],
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
