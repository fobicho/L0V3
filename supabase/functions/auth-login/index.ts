import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const USER_SECRET = Deno.env.get("USER_SECRET")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

const ALLOWED_ORIGINS = new Set([
  "https://cartas.fobicho.tech",
  "http://localhost:3000",
]);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://cartas.fobicho.tech",
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

async function updateRateLimit(key: string, clear = false): Promise<{ allowed: boolean; retryAfter: number }> {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceKey) throw new Error("Rate limit configuration missing");
  const rpc = clear ? "clear_login_rate_limit" : "check_login_rate_limit";
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: clear ? JSON.stringify({ client_key_input: key }) : JSON.stringify({ client_key_input: key }),
  });
  if (!res.ok) throw new Error("Rate limit service unavailable");
  if (clear) return { allowed: true, retryAfter: 0 };
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { allowed: row?.allowed === true, retryAfter: Number(row?.retry_after || 900) };
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
  let rateLimit;
  try {
    rateLimit = await updateRateLimit(clientKey);
  } catch {
    return new Response(JSON.stringify({ error: "Servicio temporalmente no disponible" }), {
      status: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Demasiados intentos. Intenta nuevamente más tarde." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rateLimit.retryAfter), ...corsHeaders },
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

    await updateRateLimit(clientKey, true);
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
