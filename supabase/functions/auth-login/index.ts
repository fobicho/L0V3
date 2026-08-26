import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const USER_SECRET = Deno.env.get("USER_SECRET")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

const ALLOWED_ORIGINS = new Set([
  "https://cartas-elp.pages.dev",
  "http://localhost:3000",
]);
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://cartas-elp.pages.dev",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function getClientKey(req: Request): string {
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || "unknown";
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count++;
  return true;
}

function clearRateLimit(key: string): void {
  attempts.delete(key);
}

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signJWT(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const body = { ...payload, iat: now, exp: now + 24 * 60 * 60 };

  const headerB64 = base64url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const bodyB64 = base64url(new TextEncoder().encode(JSON.stringify(body)));

  const key = await importKey(JWT_SECRET);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${headerB64}.${bodyB64}`)
  );

  return `${headerB64}.${bodyB64}.${base64url(new Uint8Array(signature))}`;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const clientKey = getClientKey(req);
  if (!checkRateLimit(clientKey)) {
    return new Response(JSON.stringify({ error: "Demasiados intentos. Intenta nuevamente más tarde." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "900", ...corsHeaders },
    });
  }

  try {
    const { secret } = await req.json();
    const trimmed = typeof secret === "string" ? secret.trim() : "";

    if (typeof trimmed !== "string" || !trimmed || trimmed.length > 128) {
      return new Response(
        JSON.stringify({ error: "Ingresa tu código de acceso" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let role: string | null = null;
    if (trimmed === USER_SECRET) role = "user";
    else if (trimmed === ADMIN_SECRET) role = "admin";

    if (!role) {
      return new Response(JSON.stringify({ error: "Código incorrecto" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    clearRateLimit(clientKey);
    const token = await signJWT({ role });

    return new Response(
      JSON.stringify({ token, role, expiresIn: "24h" }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Error del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
