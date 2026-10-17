const defaultCorsOrigins = [
  'http://localhost:5173',
  "https://buy-market-web.vercel.app",
  "https://hdphxs14-5173.brs.devtunnels.ms",
  "https://xwjbvbw0-5173.brs.devtunnels.ms",
  "https://buymarket.com.ar",
  "https://www.buymarket.com.ar",
  "https://buy-market-djckbqd0p-nicodev1.vercel.app"
];

// Vercel generates a new URL per preview deploy (buy-market-<hash>-nicodev1.vercel.app).
const vercelPreviewOrigin = /^https:\/\/buy-market-[a-z0-9]+-nicodev1\.vercel\.app$/;

export function getCorsOrigins() {
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set([...defaultCorsOrigins, ...(configuredOrigins ?? [])]),
  );
}

export function isAllowedOrigin(origin: string | undefined) {
  // Requests without Origin (curl, server-to-server, webhooks) are not CORS requests.
  if (!origin) return true;
  return getCorsOrigins().includes(origin) || vercelPreviewOrigin.test(origin);
}
