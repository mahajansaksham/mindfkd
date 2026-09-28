// Static Next export needs its boot scripts; do not add unsafe-eval.
export function secureResponse(response: Response, isHTML = false) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  if (isHTML) {
    headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.googletagmanager.com https://va.vercel-scripts.com",
        "style-src 'self' 'unsafe-inline' https://accounts.google.com",
        "img-src 'self' data: https://*.googleusercontent.com https://www.google-analytics.com https://www.googletagmanager.com",
        "connect-src 'self' https://accounts.google.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://vitals.vercel-insights.com",
        "frame-src https://accounts.google.com",
        "font-src 'self' data:",
        "upgrade-insecure-requests",
      ].join("; "),
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
