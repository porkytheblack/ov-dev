/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    // In the production Docker setup, Caddy intercepts /api/* at the edge and
    // these rewrites are never hit. This is only useful for `pnpm dev` outside
    // Docker, where the dashboard runs on :3000 and ov-api on :3001.
    const api = (process.env.INTERNAL_API_URL ?? "http://ov-api:3001").replace(/\/+$/, "");
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};
module.exports = nextConfig;
