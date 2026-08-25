import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const USER_SECRET = Deno.env.get("USER_SECRET")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { secret } = await req.json();
    const trimmed = secret?.trim();

    if (!trimmed) {
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
