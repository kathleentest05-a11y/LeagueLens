/** @type {import('next').NextConfig} */
const nextConfig = {
  // Consume the workspace shared package (built dist; transpile is belt-and-braces).
  transpilePackages: ['@leaguelens/shared'],
};

export default nextConfig;
