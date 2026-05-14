/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://ov-api:3001";
    return [
      // HTTP API only; the /events WebSocket is reverse-proxied by Caddy in prod.
      { source: "/api/:path*", destination: `${api}/api/:path*` },
    ];
  },
};
module.exports = nextConfig;
