import { DurableObject } from "cloudflare:workers";

const INSTALL_EVENTS = new Set(["pressed", "accepted", "installed"]);

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
      const payload = await request.json().catch(() => null);
      const event = payload?.event;
      if (!INSTALL_EVENTS.has(event)) {
        return new Response("Invalid event", { status: 400 });
      }

      this.sql.exec(
        `INSERT INTO install_stats (event, count)
         VALUES (?, 1)
         ON CONFLICT(event) DO UPDATE SET count = count + 1`,
        event
      );
      return new Response(null, { status: 204 });
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

    return new Response("Method not allowed", { status: 405 });
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
        return new Response("Method not allowed", { status: 405 });
      }

      if (request.headers.get("Origin") !== url.origin) {
        return new Response("Forbidden", { status: 403 });
      }

      return installStatsStub(env).fetch(request);
    }

    if (url.pathname === "/api/install-stats") {
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
      }

      return installStatsStub(env).fetch(
        new Request("https://install-stats.internal/", { method: "GET" })
      );
    }

    return env.ASSETS.fetch(request);
  },
};
