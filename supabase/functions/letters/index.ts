import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  try {
    const [headerB64, bodyB64, sigB64] = token.split(".");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sigB64),
      new TextEncoder().encode(`${headerB64}.${bodyB64}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(bodyB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function supabaseRequest(
  path: string,
  method: string,
  body?: unknown
): Promise<{ data: unknown; error: string | null; status: number }> {
  const res = await fetch(`${PROJECT_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) return { data: null, error: text, status: res.status };
  try {
    return { data: JSON.parse(text), error: null, status: res.status };
  } catch {
    return { data: text, error: null, status: res.status };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Token no proporcionado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload = await verifyJWT(auth.split(" ")[1]);
    if (!payload || payload.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acceso denegado" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const resourceId = pathParts.length > 1 ? pathParts[1] : null;

    if (req.method === "POST" && !resourceId) {
      const { title, content, mood } = await req.json();
      if (!title || !content) {
        return new Response(
          JSON.stringify({ error: "title y content son requeridos" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data, error, status } = await supabaseRequest("letters", "POST", {
        title,
        content,
        mood: mood || null,
      });
      if (error) {
        return new Response(JSON.stringify({ error }), {
          status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify(Array.isArray(data) ? data[0] : data), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "PUT" && resourceId) {
      const { data: existing, error: fetchErr } = await supabaseRequest(
        `letters?id=eq.${resourceId}&select=*`,
        "GET"
      );
      if (fetchErr || !existing || !existing.length) {
        return new Response(JSON.stringify({ error: "Carta no encontrada" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const old = existing[0];

      const { data: historyRows } = await supabaseRequest(
        `letter_history?letter_id=eq.${resourceId}&select=version`,
        "GET"
      );
      const version = (historyRows?.length || 0) + 1;

      await supabaseRequest("letter_history", "POST", {
        letter_id: resourceId,
        title: old.title,
        content: old.content,
        mood: old.mood,
        version,
        saved_at: old.updated_at,
      });

      const body = await req.json();
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) updates.title = body.title;
      if (body.content !== undefined) updates.content = body.content;
      if (body.mood !== undefined) updates.mood = body.mood;

      const { data, error, status } = await supabaseRequest(
        `letters?id=eq.${resourceId}`,
        "PATCH",
        updates
      );
      if (error) {
        return new Response(JSON.stringify({ error }), {
          status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify(Array.isArray(data) ? data[0] : data), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "DELETE" && resourceId) {
      const { error: delErr, status: delStatus } = await supabaseRequest(
        `letters?id=eq.${resourceId}`,
        "DELETE"
      );
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr }), {
          status: delStatus,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({ message: "Carta eliminada" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Ruta no encontrada" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
