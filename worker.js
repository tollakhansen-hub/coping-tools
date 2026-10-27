import { DurableObject } from "cloudflare:workers";

const INSTALL_EVENTS = new Set(["pressed", "accepted", "installed"]);
const MAX_EVENT_BYTES = 256;
const FEEDBACK_PAGES = new Set(["/body-wont-settle/", "/mind-wont-stop/", "/too-much-at-once/", "/feel-low-or-shut-down/", "/something-has-happened/"]);
const FEEDBACK_CHOICES = new Set(["yes", "no"]);
const GUIDE_ACTIONS = new Set(["print", "pdf"]);
const OWNER_COOKIE = "__Secure-coping-owner";
const OWNER_SESSION_SECONDS = 30 * 24 * 60 * 60;

// Nonces also let Cloudflare attach its JavaScript detection code without
// requiring unsafe-inline. Only trusted static asset HTML is rewritten below.
const contentSecurityPolicy = (nonce) => [
  "default-src 'self'",
  `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""} https://static.cloudflareinsights.com https://challenges.cloudflare.com`,
  "script-src-attr 'none'",
  "connect-src 'self' https://cloudflareinsights.com https://challenges.cloudflare.com",
  "style-src 'self'",
  "style-src-attr 'none'",
  "font-src 'self'",
  "img-src 'self' data:",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'"
].join("; ");


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


async function readToolFeedback(request) {
  const length = request.headers.get("Content-Length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_EVENT_BYTES)) {
    return { error: apiResponse("Request body too large", 413) };
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: apiResponse("Expected application/json", 415) };
  }
  if (!request.body) return { error: apiResponse("Invalid feedback", 400) };
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
    if (!payload || Array.isArray(payload) || Object.keys(payload).length !== 2 ||
        !FEEDBACK_PAGES.has(payload.page) || !FEEDBACK_CHOICES.has(payload.answer)) {
      return { error: apiResponse("Invalid feedback", 400) };
    }
    return { page: payload.page, answer: payload.answer };
  } catch {
    return { error: apiResponse("Invalid feedback", 400) };
  } finally {
    reader.releaseLock();
  }
}


async function readBoundedJson(request, maxBytes) {
  const length = request.headers.get("Content-Length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    return { error: apiResponse("Request body too large", 413) };
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: apiResponse("Expected application/json", 415) };
  }
  if (!request.body) return { error: apiResponse("Invalid request", 400) };
  const reader = request.body.getReader();
  let bytes = new Uint8Array(0);
  try {
    const parts = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        reader.cancel().catch(() => {});
        return { error: apiResponse("Request body too large", 413) };
      }
      parts.push(value);
    }
    bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return { payload: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { error: apiResponse("Invalid request", 400) };
  } finally {
    reader.releaseLock();
  }
}

function fixedTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  for (let i = 0, n = Math.max(a.length, b.length); i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function sessionSignature(secret, expires) {
  const encoding = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoding.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoding.encode("coping-owner-stats-v1:" + expires));
  return btoa(String.fromCharCode(...new Uint8Array(signed)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hasOwnerSession(request, secret) {
  if (!secret) return false;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)__Secure-coping-owner=([^;]+)/);
  if (!match) return false;
  const parts = match[1].split(".");
  if (parts.length !== 2 || !/^\d{10}$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return false;
  const expires = Number(parts[0]);
  const now = Math.floor(Date.now() / 1000);
  if (expires <= now || expires > now + OWNER_SESSION_SECONDS) return false;
  return fixedTimeEqual(parts[1], await sessionSignature(secret, expires));
}

function ownerCookie(value, maxAge) {
  return OWNER_COOKIE + "=" + value + "; Path=/api/owner-stats; HttpOnly; Secure; SameSite=Strict; Max-Age=" + maxAge;
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
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS tool_feedback (
        day TEXT NOT NULL,
        page TEXT NOT NULL,
        answer TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, page, answer)
      )
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS guide_actions (
        day TEXT NOT NULL,
        page TEXT NOT NULL,
        action TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, page, action)
      )
    `);
  }

  async fetch(request) {

    if (new URL(request.url).pathname === "/guide") {
      if (request.method !== "POST") return apiResponse("Method not allowed", 405, { Allow: "POST" });
      const { payload, error } = await readBoundedJson(request, MAX_EVENT_BYTES);
      if (error) return error;
      if (!payload || Array.isArray(payload) || Object.keys(payload).length !== 2 ||
          !FEEDBACK_PAGES.has(payload.page) || !GUIDE_ACTIONS.has(payload.action)) {
        return apiResponse("Invalid action", 400);
      }
      const day = new Date().toISOString().slice(0, 10);
      this.sql.exec(
        "INSERT INTO guide_actions (day, page, action, count) VALUES (?, ?, ?, 1) " +
        "ON CONFLICT(day, page, action) DO UPDATE SET count = count + 1",
        day, payload.page, payload.action
      );
      return apiResponse(null, 204);
    }

    if (new URL(request.url).pathname === "/owner") {
      if (request.method !== "GET") return apiResponse("Method not allowed", 405, { Allow: "GET" });
      const feedbackByPage = Object.fromEntries([...FEEDBACK_PAGES].map(page => [page, { yes: 0, no: 0 }]));
      const guideByPage = Object.fromEntries([...FEEDBACK_PAGES].map(page => [page, { print: 0, pdf: 0 }]));
      for (const row of this.sql.exec("SELECT page, answer, SUM(count) AS count FROM tool_feedback GROUP BY page, answer")) {
        if (feedbackByPage[row.page] && row.answer in feedbackByPage[row.page]) {
          feedbackByPage[row.page][row.answer] = Number(row.count);
        }
      }
      for (const row of this.sql.exec("SELECT page, action, SUM(count) AS count FROM guide_actions GROUP BY page, action")) {
        if (guideByPage[row.page] && row.action in guideByPage[row.page]) {
          guideByPage[row.page][row.action] = Number(row.count);
        }
      }
      const feedbackLast30Days = [...this.sql.exec(
        "SELECT day, page, answer, count FROM tool_feedback WHERE day >= date('now', '-29 days') ORDER BY day DESC, page, answer"
      )].map(row => ({ day: row.day, page: row.page, answer: row.answer, count: Number(row.count) }));
      const guideLast30Days = [...this.sql.exec(
        "SELECT day, page, action, count FROM guide_actions WHERE day >= date('now', '-29 days') ORDER BY day DESC, page, action"
      )].map(row => ({ day: row.day, page: row.page, action: row.action, count: Number(row.count) }));
      const installs = { pressed: 0, accepted: 0, installed: 0 };
      for (const row of this.sql.exec("SELECT event, count FROM install_stats")) {
        if (row.event in installs) installs[row.event] = Number(row.count);
      }
      return Response.json({
        feedback: { byPage: feedbackByPage, last30Days: feedbackLast30Days },
        guides: { byPage: guideByPage, last30Days: guideLast30Days },
        installs
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (new URL(request.url).pathname === "/feedback") {
      if (request.method === "POST") {
        const { page, answer, error } = await readToolFeedback(request);
        if (error) return error;
        const day = new Date().toISOString().slice(0, 10);
        this.sql.exec(
          `INSERT INTO tool_feedback (day, page, answer, count)
           VALUES (?, ?, ?, 1)
           ON CONFLICT(day, page, answer) DO UPDATE SET count = count + 1`,
          day, page, answer
        );
        return apiResponse(null, 204);
      }
      if (request.method === "GET") {
        const byPage = Object.fromEntries([...FEEDBACK_PAGES].map(page => [page, { yes: 0, no: 0 }]));
        for (const row of this.sql.exec(
          "SELECT page, answer, SUM(count) AS count FROM tool_feedback GROUP BY page, answer"
        )) {
          if (byPage[row.page] && row.answer in byPage[row.page]) {
            byPage[row.page][row.answer] = Number(row.count);
          }
        }
        const last30Days = [...this.sql.exec(
          "SELECT day, page, answer, count FROM tool_feedback WHERE day >= date('now', '-29 days') ORDER BY day DESC, page, answer"
        )].map(row => ({ day: row.day, page: row.page, answer: row.answer, count: Number(row.count) }));
        return Response.json({ byPage, last30Days }, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      return apiResponse("Method not allowed", 405, { Allow: "GET, POST" });
    }

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

async function handleRequest(request, env) {
    const url = new URL(request.url);

    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }


    if (url.pathname === "/api/guide-event") {
      if (request.method !== "POST") return apiResponse("Method not allowed", 405, { Allow: "POST" });
      if (request.headers.get("Origin") !== url.origin) return apiResponse("Forbidden", 403);
      const { payload, error } = await readBoundedJson(request, MAX_EVENT_BYTES);
      if (error) return error;
      if (!payload || Array.isArray(payload) || Object.keys(payload).length !== 2 ||
          !FEEDBACK_PAGES.has(payload.page) || !GUIDE_ACTIONS.has(payload.action)) {
        return apiResponse("Invalid action", 400);
      }
      // Forward only the validated action and route, never visitor headers or identifiers.
      return forwardInstallStats(env, new Request("https://install-stats.internal/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: payload.page, action: payload.action })
      }));
    }

    if (url.pathname === "/api/owner-stats/login") {
      if (request.method !== "POST") return apiResponse("Method not allowed", 405, { Allow: "POST" });
      if (request.headers.get("Origin") !== url.origin) return apiResponse("Forbidden", 403);
      if (!env.STATS_READ_TOKEN) return apiResponse("Owner access not configured", 503);
      const { payload, error } = await readBoundedJson(request, 1024);
      if (error) return error;
      if (!payload || Array.isArray(payload) || Object.keys(payload).length !== 1 ||
          !fixedTimeEqual(payload.token, env.STATS_READ_TOKEN)) {
        return apiResponse("Incorrect statistics token", 401);
      }
      const expires = Math.floor(Date.now() / 1000) + OWNER_SESSION_SECONDS;
      const cookie = ownerCookie(expires + "." + await sessionSignature(env.STATS_READ_TOKEN, expires), OWNER_SESSION_SECONDS);
      return apiResponse(null, 204, { "Set-Cookie": cookie });
    }

    if (url.pathname === "/api/owner-stats/logout") {
      if (request.method !== "POST") return apiResponse("Method not allowed", 405, { Allow: "POST" });
      if (request.headers.get("Origin") !== url.origin) return apiResponse("Forbidden", 403);
      return apiResponse(null, 204, { "Set-Cookie": ownerCookie("", 0) });
    }

    if (url.pathname === "/api/owner-stats") {
      if (request.method !== "GET") return apiResponse("Method not allowed", 405, { Allow: "GET" });
      if (!await hasOwnerSession(request, env.STATS_READ_TOKEN)) return apiResponse("Not authorized", 401);
      return forwardInstallStats(env, new Request("https://install-stats.internal/owner", { method: "GET" }));
    }

    if (url.pathname === "/api/tool-feedback") {
      if (request.method !== "POST") {
        return apiResponse("Method not allowed", 405, { Allow: "POST" });
      }
      if (request.headers.get("Origin") !== url.origin) {
        return apiResponse("Forbidden", 403);
      }
      const { page, answer, error } = await readToolFeedback(request);
      if (error) return error;
      // Store only the page, choice and UTC day: do not forward client headers.
      return forwardInstallStats(env,
        new Request("https://install-stats.internal/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page, answer }),
        })
      );
    }

    if (url.pathname === "/api/tool-feedback-stats") {
      if (request.method !== "GET") {
        return apiResponse("Method not allowed", 405, { Allow: "GET" });
      }
      if (!env.STATS_READ_TOKEN ||
          request.headers.get("Authorization") !== `Bearer ${env.STATS_READ_TOKEN}`) {
        return apiResponse("Not found", 404);
      }
      return forwardInstallStats(env,
        new Request("https://install-stats.internal/feedback", { method: "GET" })
      );
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
      // No read token configured: the statistics endpoint is private by default.
      // A maintainer can configure STATS_READ_TOKEN as a Cloudflare Worker secret.
      if (!env.STATS_READ_TOKEN ||
          request.headers.get("Authorization") !== `Bearer ${env.STATS_READ_TOKEN}`) {
        return apiResponse("Not found", 404);
      }

      return forwardInstallStats(env,
        new Request("https://install-stats.internal/", { method: "GET" })
      );
    }

    // A 304 must not pair an old cached HTML body with a new CSP nonce.
    // Fetch complete HTML so its body and policy are generated together.
    const lastSegment = url.pathname.split("/").pop();
    if (!lastSegment || !lastSegment.includes(".") || lastSegment.endsWith(".html")) {
      const headers = new Headers(request.headers);
      headers.delete("If-None-Match");
      headers.delete("If-Modified-Since");
      return env.ASSETS.fetch(new Request(request, { headers }));
    }
    return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    const response = await handleRequest(request, env);
    const url = new URL(request.url);
    if (url.protocol !== "https:") {
      return response;
    }

    const headers = new Headers(response.headers);
    // Apply the same CSP on previews; restrict the longer HTTPS commitment
    // to the production hostname, without includeSubDomains or preload.
    if (url.hostname === "coping.tools") {
      headers.set("Strict-Transport-Security", "max-age=15552000");
    }
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    const isHTML = headers.get("Content-Type")?.toLowerCase().includes("text/html");
    const nonce = isHTML ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))) : null;
    headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
    headers.delete("Content-Security-Policy-Report-Only");
    if (isHTML) {
      // Retain offline service-worker caching, but never share a nonce-bearing
      // page through an intermediary cache or reuse the static asset's ETag.
      headers.set("Cache-Control", "private, no-cache");
      headers.delete("ETag");
      headers.delete("Last-Modified");
      headers.delete("Content-Length");
    }
    const secured = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    if (!isHTML || !response.body) return secured;
    return new HTMLRewriter()
      .on("script", { element(element) { element.setAttribute("nonce", nonce); } })
      .transform(secured);
  },
};
