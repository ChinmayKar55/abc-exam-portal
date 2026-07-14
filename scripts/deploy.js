#!/usr/bin/env node
/**
 * Hostinger Docker Manager deploy script
 *
 * Usage:
 *   node scripts/deploy.js deploy   — first-time: create project from docker-compose.yml
 *   node scripts/deploy.js update   — pull latest images + recreate containers
 *   node scripts/deploy.js restart  — restart all containers (no image pull)
 *   node scripts/deploy.js status   — list containers + health
 *   node scripts/deploy.js logs     — last 300 log lines across all services
 *   node scripts/deploy.js down     — tear down the entire project (destructive)
 *
 * Required env vars:
 *   HOSTINGER_API_TOKEN  — from https://hpanel.hostinger.com/profile/api
 *   HOSTINGER_VM_ID      — numeric VM ID visible in hPanel VPS section URL
 *
 * Optional env vars:
 *   HOSTINGER_PROJECT    — Docker Compose project name (default: abc-exam)
 *   COMPOSE_FILE         — path to docker-compose.yml (default: ./docker-compose.yml)
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://developers.hostinger.com";
const PROJECT  = process.env.HOSTINGER_PROJECT ?? "abc-exam";
const TOKEN    = process.env.HOSTINGER_API_TOKEN;
const VM_ID    = process.env.HOSTINGER_VM_ID;

function assertEnv() {
  const missing = [];
  if (!TOKEN)  missing.push("HOSTINGER_API_TOKEN");
  if (!VM_ID)  missing.push("HOSTINGER_VM_ID");
  if (missing.length) {
    console.error(`\n❌  Missing required env vars: ${missing.join(", ")}\n`);
    console.error("Set them in your shell or in a .env.deploy file (never commit it).");
    process.exit(1);
  }
}

async function api(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    console.error(`\n❌  ${method} ${path} → ${res.status} ${res.statusText}`);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

const vmPath   = `/api/vps/v1/virtual-machines/${VM_ID}`;
const projPath = `${vmPath}/docker/${PROJECT}`;

const commands = {
  // ── First-time deploy ──────────────────────────────────────────────────────
  async deploy() {
    const composePath = resolve(
      process.env.COMPOSE_FILE ?? "./docker-compose.yml"
    );
    let composeContent;
    try {
      composeContent = readFileSync(composePath, "utf8");
    } catch {
      console.error(`\n❌  Cannot read compose file at: ${composePath}`);
      process.exit(1);
    }

    console.log(`\n🚀  Creating project "${PROJECT}" on VM ${VM_ID}...`);
    const result = await api("POST", `${vmPath}/docker`, {
      project_name: PROJECT,
      content:      composeContent,
    });
    console.log("✅  Project creation triggered.");
    console.log("    Action ID:", result.id ?? "(see response)");
    console.log(JSON.stringify(result, null, 2));
  },

  // ── Redeploy: pull latest images + recreate containers ────────────────────
  async update() {
    console.log(`\n🔄  Updating project "${PROJECT}" on VM ${VM_ID}...`);
    console.log("    Pulling latest images and recreating containers...");
    const result = await api("POST", `${projPath}/update`);
    console.log("✅  Update triggered. Containers will be recreated shortly.");
    console.log("    Action ID:", result.id ?? "(see response)");
    console.log(JSON.stringify(result, null, 2));
  },

  // ── Restart containers (no image pull) ────────────────────────────────────
  async restart() {
    console.log(`\n🔁  Restarting project "${PROJECT}" on VM ${VM_ID}...`);
    const result = await api("POST", `${projPath}/restart`);
    console.log("✅  Restart triggered.");
    console.log(JSON.stringify(result, null, 2));
  },

  // ── Container status ──────────────────────────────────────────────────────
  async status() {
    console.log(`\n📊  Container status for "${PROJECT}" on VM ${VM_ID}:\n`);
    const result = await api("GET", `${projPath}/containers`);
    const containers = Array.isArray(result) ? result : result.data ?? [];
    if (containers.length === 0) {
      console.log("  (no containers found)");
      return;
    }
    const width = { name: 30, image: 40, status: 12, health: 10 };
    const header =
      "NAME".padEnd(width.name) +
      "IMAGE".padEnd(width.image) +
      "STATUS".padEnd(width.status) +
      "HEALTH";
    console.log(header);
    console.log("─".repeat(header.length + 4));
    for (const c of containers) {
      const health = c.health ?? c.Health ?? "—";
      const status = c.status ?? c.Status ?? "—";
      const icon   = status === "running" ? "🟢" : status === "exited" ? "🔴" : "🟡";
      console.log(
        `${icon} ${(c.name ?? c.Names ?? "").padEnd(width.name - 2)}` +
        `${(c.image ?? c.Image ?? "").padEnd(width.image)}` +
        `${status.padEnd(width.status)}` +
        health
      );
    }
    console.log();
  },

  // ── Logs ──────────────────────────────────────────────────────────────────
  async logs() {
    console.log(`\n📋  Logs for "${PROJECT}" on VM ${VM_ID} (last 300 lines):\n`);
    const result = await api("GET", `${projPath}/logs`);
    const entries = Array.isArray(result) ? result : result.data ?? [];
    if (entries.length === 0) {
      console.log("  (no log entries)");
      return;
    }
    for (const entry of entries) {
      const ts      = entry.timestamp ?? entry.time ?? "";
      const service = entry.service   ?? entry.container_name ?? "unknown";
      const msg     = entry.log       ?? entry.message ?? entry.line ?? "";
      console.log(`[${ts}] [${service}] ${msg}`);
    }
  },

  // ── Tear down (destructive) ───────────────────────────────────────────────
  async down() {
    const args = process.argv.slice(3);
    if (!args.includes("--confirm")) {
      console.error("\n⚠️   This will DESTROY all containers, networks, and volumes.");
      console.error("    Re-run with --confirm to proceed:\n");
      console.error("    node scripts/deploy.js down --confirm\n");
      process.exit(1);
    }
    console.log(`\n💀  Tearing down project "${PROJECT}" on VM ${VM_ID}...`);
    const result = await api("DELETE", `${projPath}/down`);
    console.log("✅  Teardown triggered.");
    console.log(JSON.stringify(result, null, 2));
  },
};

async function main() {
  const cmd = process.argv[2];
  if (!cmd || !commands[cmd]) {
    console.error("\nUsage: node scripts/deploy.js <command>");
    console.error("Commands: deploy | update | restart | status | logs | down\n");
    process.exit(1);
  }
  assertEnv();
  await commands[cmd]();
}

main().catch((err) => {
  console.error("\n❌  Unexpected error:", err.message);
  process.exit(1);
});
