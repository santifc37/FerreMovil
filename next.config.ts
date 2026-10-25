import type { NextConfig } from "next";

const apiUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

// Direcciones desde las que se puede abrir la app en desarrollo (por ejemplo,
// desde el celular en la misma red). Sin esto, Next bloquea sus scripts y los
// botones no responden. Puedes añadir más con DEV_ORIGINS="192.168.1.5,otra".
const origenesDeDesarrollo = [
  "192.168.1.2",
  ...(process.env.DEV_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
].filter(Boolean);

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: origenesDeDesarrollo,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default config;