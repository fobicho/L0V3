import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

const ALLOWED_ORIGINS = new Set(["https://cartas.fobicho.tech", "http://localhost:3000"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://cartas.fobicho.tech",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://cartas.fobicho.tech",
    "Vary": "Origin",
  };
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  try {
    const [headerB64, bodyB64, sigB64] = token.split(".");
    if (!headerB64 || !bodyB64 || !sigB64) return null;
    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
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
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    if (payload.role !== "admin" && payload.role !== "user") return null;
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

const BUCKET = "letter-images";
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20000;
const MAX_MOOD_LENGTH = 50;
const MAX_REQUEST_BYTES = 256 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function storagePathFromUrl(urlStr: string | null): string | null {
  if (!urlStr) return null;
  const marker = `/object/public/${BUCKET}/`;
  const i = urlStr.indexOf(marker);
  if (i !== -1) return urlStr.slice(i + marker.length);
  if (/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(urlStr)) return urlStr;
  return null;
}

async function createSignedUrl(path: string): Promise<string | null> {
  const response = await fetch(
    `${PROJECT_URL}/storage/v1/object/sign/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.signedURL ? `${PROJECT_URL}/storage/v1${data.signedURL}` : null;
}

async function addSignedImageUrls(letter: Record<string, unknown>): Promise<void> {
  if (!Array.isArray(letter.images)) return;
  const signed = await Promise.all(letter.images.map(async (image) => {
    const path = storagePathFromUrl(typeof image === "string" ? image : null);
    return path ? await createSignedUrl(path) : null;
  }));
  letter.images = signed.filter((url): url is string => Boolean(url));
}

async function handleImageUpload(file: File): Promise<Response> {
  if (!file.type.startsWith("image/")) {
    return new Response(JSON.stringify({ error: "El archivo debe ser una imagen" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return new Response(JSON.stringify({ error: "Imagen muy grande (máx 5MB)" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${crypto.randomUUID()}.${ext}`;
  const uploadRes = await fetch(
    `${PROJECT_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: file,
    }
  );
  if (!uploadRes.ok) {
    return new Response(JSON.stringify({ error: "No se pudo subir la imagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const signedUrl = await createSignedUrl(path);
  if (!signedUrl) {
    return new Response(JSON.stringify({ error: "No se pudo preparar la imagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  return new Response(JSON.stringify({ path, url: signedUrl }), {
    status: 201,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleImageDelete(urlStr: string | null): Promise<Response> {
  const path = storagePathFromUrl(urlStr);
  if (!path) {
    return new Response(JSON.stringify({ error: "URL inválida" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const delRes = await fetch(
    `${PROJECT_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
    }
  );
  return new Response(JSON.stringify({ ok: delRes.ok }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function sanitizeImages(images: unknown): string[] | null {
  if (!Array.isArray(images)) return null;
  const urls = images
    .map((u) => typeof u === "string" ? storagePathFromUrl(u) : null)
    .filter((u): u is string => Boolean(u))
    .slice(0, MAX_IMAGES);
  return urls;
}

serve(async (req: Request): Promise<Response> => {
  const responseCorsHeaders = getCorsHeaders(req);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return new Response(JSON.stringify({ error: "Solicitud demasiado grande" }), {
      status: 413,
      headers: { "Content-Type": "application/json", ...responseCorsHeaders },
    });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: responseCorsHeaders });
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
    if (!payload || (payload.role !== "admin" && payload.role !== "user")) {
      return new Response(JSON.stringify({ error: "Acceso denegado" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const url = new URL(req.url);
    const urlParams = url.searchParams;
    const isUploadRoute = url.pathname.endsWith("/upload");

    if (isUploadRoute) {
      if (payload.role !== "admin") {
        return new Response(JSON.stringify({ error: "Acceso denegado" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (req.method === "POST") {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
          return new Response(JSON.stringify({ error: "Archivo no proporcionado" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        return await handleImageUpload(file);
      }
      if (req.method === "DELETE") {
        return await handleImageDelete(urlParams.get("url"));
      }
      return new Response(JSON.stringify({ error: "Método no permitido" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const lettersIndex = pathParts.indexOf("letters");
    const resourceId = (lettersIndex !== -1 && lettersIndex < pathParts.length - 1)
      ? pathParts[lettersIndex + 1]
      : null;
    if (resourceId && !UUID_PATTERN.test(resourceId)) {
      return new Response(JSON.stringify({ error: "Identificador inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "POST" && pathParts[lettersIndex + 1] && pathParts[lettersIndex + 2] === "read") {
      const letterId = pathParts[lettersIndex + 1];
      const { error, status } = await supabaseRequest("letter_reads", "POST", {
        letter_id: letterId,
        reader_role: payload.role,
      });
      if (error && !error.includes("duplicate key")) {
        return new Response(JSON.stringify({ error }), {
          status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "GET") {
      const path = resourceId
        ? `letters?id=eq.${encodeURIComponent(resourceId)}&select=id,title,content,mood,images,created_at,updated_at`
        : "letters?select=id,title,content,mood,images,created_at,updated_at&order=created_at.desc";
      const { data, error, status } = await supabaseRequest(path, "GET");
      if (error) {
        return new Response(JSON.stringify({ error }), {
          status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (resourceId && (!Array.isArray(data) || !data.length)) {
        return new Response(JSON.stringify({ error: "Carta no encontrada" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (!resourceId && Array.isArray(data)) {
        const reads = await supabaseRequest(
          `letter_reads?reader_role=eq.${payload.role}&select=letter_id`,
          "GET"
        );
        const readIds = new Set(
          Array.isArray(reads.data) ? reads.data.map((row) => row.letter_id) : []
        );
        for (const letter of data) letter.is_read = readIds.has(letter.id);
      }
      if (resourceId) await addSignedImageUrls(data[0]);
      else if (Array.isArray(data)) await Promise.all(data.map(addSignedImageUrls));
      return new Response(JSON.stringify(resourceId ? data[0] : data), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (payload.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acceso denegado" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "DELETE" && urlParams.get("all") === "true" && !resourceId) {
      const { data: existing, error: getErr } = await supabaseRequest("letters?select=images", "GET");
      if (getErr) {
        return new Response(JSON.stringify({ error: getErr }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      for (const letter of (Array.isArray(existing) ? existing : [])) {
        for (const imgUrl of (Array.isArray(letter.images) ? letter.images : [])) {
          await handleImageDelete(imgUrl);
        }
      }
      const { error: delErr, status: delStatus } = await supabaseRequest("letters?id=not.is.null", "DELETE");
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr }), {
          status: delStatus,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({ message: "Todas las cartas fueron eliminadas" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "POST" && !resourceId) {
      const { title, content, mood, images } = await req.json();
      if (typeof title !== "string" || typeof content !== "string"
        || !title.trim() || !content.trim()
        || title.trim().length > MAX_TITLE_LENGTH
        || content.length > MAX_CONTENT_LENGTH
        || (mood !== undefined && mood !== null
          && (typeof mood !== "string" || mood.length > MAX_MOOD_LENGTH))
        || (images !== undefined && !Array.isArray(images))) {
        return new Response(
          JSON.stringify({ error: "Datos de carta inválidos" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const imagesArr = sanitizeImages(images) ?? [];
      const { data, error, status } = await supabaseRequest("letters", "POST", {
        title: title.trim(),
        content: content.trim(),
        mood: mood || null,
        images: imagesArr,
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
      const body = await req.json();
      if (typeof body.title !== "string" || !body.title.trim()
        || typeof body.content !== "string" || !body.content.trim()) {
        return new Response(JSON.stringify({ error: "title y content son requeridos" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (body.title.trim().length > MAX_TITLE_LENGTH
        || body.content.length > MAX_CONTENT_LENGTH
        || (body.mood !== undefined && body.mood !== null
          && (typeof body.mood !== "string" || body.mood.length > MAX_MOOD_LENGTH))
        || (body.images !== undefined && !Array.isArray(body.images))) {
        return new Response(JSON.stringify({ error: "Datos de carta inválidos" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const patch: Record<string, unknown> = {
        title: body.title.trim(),
        content: body.content,
        mood: typeof body.mood === "string" ? body.mood : null,
        updated_at: new Date().toISOString(),
      };
      if (Array.isArray(body.images)) {
        patch.images = sanitizeImages(body.images) ?? [];
      }
      const { data, error, status } = await supabaseRequest(
        `letters?id=eq.${encodeURIComponent(resourceId)}`,
        "PATCH",
        patch
      );
      if (error) {
        return new Response(JSON.stringify({ error }), {
          status: status === 404 ? 404 : status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify(Array.isArray(data) ? data[0] : data), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "DELETE" && resourceId) {
      const { data: existing, error: getErr } = await supabaseRequest(
        `letters?id=eq.${encodeURIComponent(resourceId)}&select=images`,
        "GET"
      );
      if (getErr) {
        return new Response(JSON.stringify({ error: getErr }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const imgs = Array.isArray(existing) && existing[0]?.images ? existing[0].images : [];
      for (const imgUrl of imgs) {
        await handleImageDelete(imgUrl);
      }
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
