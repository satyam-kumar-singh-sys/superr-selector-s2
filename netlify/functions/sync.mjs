import { getStore } from "@netlify/blobs";

export default async (request) => {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  if (!code) return new Response("Missing code", { status: 400 });

  const store = getStore({ name: "rr-sync", consistency: "strong" });

  if (request.method === "GET") {
    const data = await store.get(code, { type: "json" });
    // 200 with null means "endpoint reachable, nothing stored for this code yet".
    // A 404 would be indistinguishable from "function not deployed", which the
    // client uses to decide whether cloud sync is available at all.
    return Response.json(data ?? null, { status: 200 });
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (!body || !body.picks || !body.picks.bat) {
      return new Response("Invalid state", { status: 400 });
    }
    // Keep payload small: only sync state, strip anything unexpected
    const safe = {
      v: body.v,
      hide: body.hide,
      col: body.col,
      sort: body.sort,
      lim: body.lim,
      caps: body.caps,
      picks: body.picks,
      f: body.f,
      ts: body.ts || Date.now(),
    };
    await store.setJSON(code, safe);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/sync" };
