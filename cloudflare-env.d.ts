interface CloudflareEnv {
  DB: import("@cloudflare/workers-types").D1Database;
  ASSETS: import("@cloudflare/workers-types").Fetcher;
}
