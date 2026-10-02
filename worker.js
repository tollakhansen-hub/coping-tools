import { DurableObject } from "cloudflare:workers";

const INSTALL_EVENTS = new Set(["pressed", "accepted", "installed"]);
const MAX_EVENT_BYTES = 256;

function apiResponse(body, status, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

async function readInstallEvent(request) {
  const length = request.headers.get("Content-Length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_EVENT_BYTES)) {
    return { error: apiResponse("Request body too large", 413) };
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: apiResponse("Expected application/json", 415) };
  }
  if (!request.body) return { error: apiResponse("Invalid event", 400) };

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_EVENT_BYTES) {
        reader.cancel().catch(() => {});
        return { error: apiResponse("Request body too large", 413) };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!payload || Array.isArray(payload) ||
        Object.keys(payload).length !== 1 || !INSTALL_EVENTS.has(payload.event)) {
      return { error: apiResponse("Invalid event", 400) };
    }
    return { event: payload.event };
  } catch {
    return { error: apiResponse("Invalid event", 400) };
  } finally {
    reader.releaseLock();
  }
}

export class InstallStats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS install_stats (
        event TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  async fetch(request) {
    if (request.method === "POST") {
      const { event, error } = await readInstallEvent(request);
      if (error) return error;

      this.sql.exec(
        `INSERT INTO install_stats (event, count)
         VALUES (?, 1)
         ON CONFLICT(event) DO UPDATE SET count = count + 1`,
        event
      );
      return apiResponse(null, 204);
    }

    if (request.method === "GET") {
      const stats = { pressed: 0, accepted: 0, installed: 0 };
      for (const row of this.sql.exec("SELECT event, count FROM install_stats")) {
        if (row.event in stats) stats[row.event] = Number(row.count);
      }
      return Response.json(stats, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    return apiResponse("Method not allowed", 405, { Allow: "GET, POST" });
  }
}

async function forwardInstallStats(env, request) {
  try {
    return await installStatsStub(env).fetch(request);
  } catch {
    return apiResponse("Counter temporarily unavailable", 503);
  }
}

function installStatsStub(env) {
  const id = env.INSTALL_STATS.idFromName("global");
  return env.INSTALL_STATS.get(id);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/install-event") {
      if (request.method !== "POST") {
        return apiResponse("Method not allowed", 405, { Allow: "POST" });
      }

      if (request.headers.get("Origin") !== url.origin) {
        return apiResponse("Forbidden", 403);
      }

      const { event, error } = await readInstallEvent(request);
      if (error) return error;

      // Forward only the validated aggregate event, without visitor headers.
      return forwardInstallStats(env,
        new Request("https://install-stats.internal/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event }),
        })
      );
    }

    if (url.pathname === "/api/install-stats") {
      if (request.method !== "GET") {
        return apiResponse("Method not allowed", 405, { Allow: "GET" });
      }

      return forwardInstallStats(env,
        new Request("https://install-stats.internal/", { method: "GET" })
      );
    }

    return env.ASSETS.fetch(request);
  },
};
