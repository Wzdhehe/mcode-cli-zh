#!/usr/bin/env node
// mcode CLI i18n MCP server
// Tools: install / uninstall / switch / status
// Auto-installs on first run (silently skips if mcode not detected).

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  copyFileSync, readdirSync, unlinkSync, rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";
import { execSync } from "node:child_process";

// ─── Paths ─────────────────────────────────────────────────────────────
const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLED_SHIM = join(HERE, "i18n-shim.mjs");
const BUNDLED_PACKS = join(HERE, "i18n-packs");
const BUNDLED_PS1 = join(HERE, "mcode.ps1");
const HOME = homedir();
const MCODE_HOME = join(HOME, ".mcode");
const CONFIG_PATH = join(MCODE_HOME, "config.json");
const LOG_PATH = join(MCODE_HOME, "logs", "mcode-cli-zh.log");
const PLUGIN_VERSION = "0.4.0";

// ─── Logging ───────────────────────────────────────────────────────────
function log(...args) {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    const line = `${new Date().toISOString()} ${args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")}\n`;
    writeFileSync(LOG_PATH, line, { flag: "a" });
  } catch { /* swallow */ }
}

// ─── Detect mcode install ─────────────────────────────────────────────
function detectMcodeDir() {
  // 1) `where mcode` (Windows) or `which mcode` (Unix)
  try {
    const cmd = platform === "win32" ? "where.exe mcode" : "which mcode";
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const first = out.split(/\r?\n/).map(s => s.trim()).find(s => s && (s.endsWith(".cmd") || s.endsWith(".ps1") || !s.includes(" ")));
    if (first && existsSync(first)) return dirname(first);
  } catch { /* ignore */ }
  // 2) npm global root
  try {
    const out = execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const globalRoot = out.trim();
    const cliJs = join(globalRoot, "@minimax-ai", "code", "cli.js");
    if (existsSync(cliJs)) return dirname(globalRoot);
  } catch { /* ignore */ }
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────
function copyDirRecursive(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else if (entry.isFile()) copyFileSync(s, d);
  }
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { return fallback; }
}

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

// ─── Tool: install ────────────────────────────────────────────────────
function install() {
  const mcodeDir = detectMcodeDir();
  if (!mcodeDir) throw new Error("mcode installation not found. Please install @minimax-ai/code first.");

  const steps = [];
  const cmdPath = join(mcodeDir, "mcode.cmd");
  const ps1Path = join(mcodeDir, "mcode.ps1");
  const shimPath = join(mcodeDir, "i18n-shim.mjs");
  const packsPath = join(mcodeDir, "i18n-packs");
  const bakPath = join(mcodeDir, "mcode.cmd.bak");

  if (!existsSync(cmdPath)) throw new Error(`mcode.cmd not found at ${cmdPath}`);

  // 1. Copy shim
  copyFileSync(BUNDLED_SHIM, shimPath);
  steps.push(`copied shim -> ${shimPath}`);

  // 2. Copy packs
  mkdirSync(packsPath, { recursive: true });
  copyDirRecursive(BUNDLED_PACKS, packsPath);
  steps.push(`copied packs -> ${packsPath}`);

  // 3. Modify mcode.cmd
  let cmdContent = readFileSync(cmdPath, "utf8");
  if (cmdContent.includes("i18n-shim.mjs")) {
    steps.push("mcode.cmd already has i18n-shim.mjs, skipping");
  } else {
    if (!existsSync(bakPath)) {
      copyFileSync(cmdPath, bakPath);
      steps.push(`backed up -> ${bakPath}`);
    } else {
      steps.push("mcode.cmd.bak already exists, not overwriting");
    }
    const modified = cmdContent.replace(
      /"(%dp0%\\node_modules\\@minimax-ai\\code\\cli\.js)"/,
      '--import "file:///%dp0%\\i18n-shim.mjs" "$1"'
    );
    if (modified !== cmdContent) {
      writeFileSync(cmdPath, modified, "utf8");
      steps.push("injected --import into mcode.cmd");
    } else {
      steps.push("WARN: mcode.cmd format unexpected, --import not injected");
    }
  }

  // 4. Create mcode.ps1 (PowerShell launcher template)
  if (!existsSync(ps1Path) && existsSync(BUNDLED_PS1)) {
    copyFileSync(BUNDLED_PS1, ps1Path);
    steps.push(`created -> ${ps1Path}`);
  }

  // 5. Ensure user config exists
  if (!existsSync(CONFIG_PATH)) {
    writeJson(CONFIG_PATH, { language: "zh-CN", enabled: true });
    steps.push(`created -> ${CONFIG_PATH}`);
  }

  log("install:", steps.join(" | "));
  return { success: true, mcodeDir, steps };
}

// ─── Tool: uninstall ──────────────────────────────────────────────────
function uninstall() {
  const mcodeDir = detectMcodeDir();
  if (!mcodeDir) return { success: true, message: "mcode not found, nothing to uninstall" };

  const steps = [];
  const cmdPath = join(mcodeDir, "mcode.cmd");
  const ps1Path = join(mcodeDir, "mcode.ps1");
  const shimPath = join(mcodeDir, "i18n-shim.mjs");
  const packsPath = join(mcodeDir, "i18n-packs");
  const bakPath = join(mcodeDir, "mcode.cmd.bak");

  // 1. Restore mcode.cmd from .bak
  if (existsSync(bakPath)) {
    copyFileSync(bakPath, cmdPath);
    unlinkSync(bakPath);
    steps.push("restored mcode.cmd from .bak, removed .bak");
  } else if (existsSync(cmdPath)) {
    const content = readFileSync(cmdPath, "utf8");
    const cleaned = content.replace(/ --import "file:\/\/\/[^"]*" ?/g, " ");
    if (cleaned !== content) {
      writeFileSync(cmdPath, cleaned, "utf8");
      steps.push("removed --import from mcode.cmd (no backup was available)");
    }
  }

  // 2. Remove shim
  if (existsSync(shimPath)) { unlinkSync(shimPath); steps.push("removed i18n-shim.mjs"); }

  // 3. Remove packs
  if (existsSync(packsPath)) {
    try { rmSync(packsPath, { recursive: true, force: true }); steps.push("removed i18n-packs/"); }
    catch (e) { steps.push(`WARN: could not remove i18n-packs/: ${e.message}`); }
  }

  // 4. Remove mcode.ps1
  if (existsSync(ps1Path)) {
    try { unlinkSync(ps1Path); steps.push("removed mcode.ps1"); }
    catch (e) { steps.push(`WARN: could not remove mcode.ps1: ${e.message}`); }
  }

  log("uninstall:", steps.join(" | "));
  return { success: true, mcodeDir, steps };
}

// ─── Tool: switch ─────────────────────────────────────────────────────
function switchLang(args) {
  const locale = args?.locale;
  if (!locale || !["zh-CN", "zh-TW", "en"].includes(locale)) {
    throw new Error("locale must be one of: zh-CN, zh-TW, en");
  }
  if (!detectMcodeDir()) throw new Error("mcode installation not found");

  const config = readJson(CONFIG_PATH, {});
  config.language = locale;
  writeJson(CONFIG_PATH, config);

  log("switch:", locale, "config:", CONFIG_PATH);
  return {
    success: true,
    locale,
    configPath: CONFIG_PATH,
    note: "Restart mcode for the change to take effect.",
  };
}

// ─── Tool: translate (on/off switch) ──────────────────────────────────
function setEnabled(args) {
  const on = args?.on;
  if (typeof on !== "boolean") {
    throw new Error("on must be true or false");
  }
  if (!detectMcodeDir()) throw new Error("mcode installation not found");

  const config = readJson(CONFIG_PATH, {});
  config.enabled = on;
  writeJson(CONFIG_PATH, config);

  log("translate:", on ? "on" : "off", "config:", CONFIG_PATH);
  return {
    success: true,
    enabled: on,
    configPath: CONFIG_PATH,
    note: "Restart mcode for the change to take effect.",
  };
}

// ─── Tool: status ─────────────────────────────────────────────────────
function getStatus() {
  const mcodeDir = detectMcodeDir();
  const s = {
    mcodeInstalled: !!mcodeDir,
    mcodeDir,
    shimInstalled: false,
    shimPath: null,
    packsInstalled: false,
    packsPath: null,
    cmdModified: false,
    cmdBackupExists: false,
    ps1Installed: false,
    translationEnabled: true,
    userLanguage: null,
    userConfig: null,
    userConfigPath: CONFIG_PATH,
    pluginVersion: PLUGIN_VERSION,
  };

  if (mcodeDir) {
    const shimPath = join(mcodeDir, "i18n-shim.mjs");
    const packsPath = join(mcodeDir, "i18n-packs");
    const cmdPath = join(mcodeDir, "mcode.cmd");
    const bakPath = join(mcodeDir, "mcode.cmd.bak");
    const ps1Path = join(mcodeDir, "mcode.ps1");

    s.shimInstalled = existsSync(shimPath);
    s.shimPath = shimPath;
    s.packsInstalled = existsSync(packsPath);
    s.packsPath = packsPath;
    s.cmdBackupExists = existsSync(bakPath);

    if (existsSync(cmdPath)) {
      s.cmdModified = readFileSync(cmdPath, "utf8").includes("i18n-shim.mjs");
    }
    s.ps1Installed = existsSync(ps1Path);
  }

  const cfg = readJson(CONFIG_PATH, null);
  s.userConfig = cfg;
  if (cfg) {
    s.translationEnabled = cfg.enabled !== false;
    s.userLanguage = cfg.language || null;
  }
  return s;
}

// ─── Auto-install on startup ──────────────────────────────────────────
try {
  if (detectMcodeDir()) {
    install();
  } else {
    log("auto-install skipped: mcode not found");
  }
} catch (e) {
  log("auto-install failed:", e.message);
}

// ─── MCP protocol (JSON-RPC 2.0 over stdio) ──────────────────────────
const TOOLS = [
  {
    name: "install",
    description: "安装 mcode 汉化:复制 shim + 字典包到 mcode 目录,修改 mcode.cmd 注入 --import。已安装则跳过。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "uninstall",
    description: "卸载 mcode 汉化:恢复 mcode.cmd 备份,删除 shim + 字典包 + mcode.ps1。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "switch",
    description: "切换 mcode 显示语言。修改 ~/.mcode/config.json 的 language 字段,重启 mcode 生效。",
    inputSchema: {
      type: "object",
      properties: {
        locale: { type: "string", enum: ["zh-CN", "zh-TW", "en"], description: "目标语言" },
      },
      required: ["locale"],
      additionalProperties: false,
    },
  },
  {
    name: "translate",
    description: "翻译开关(独立于 language 切换)。true = 翻译生效,false = 不翻译。修改 ~/.mcode/config.json 的 enabled 字段,重启 mcode 生效。",
    inputSchema: {
      type: "object",
      properties: {
        on: { type: "boolean", description: "true 开启翻译,false 关闭翻译" },
      },
      required: ["on"],
      additionalProperties: false,
    },
  },
  {
    name: "status",
    description: "查看 mcode 汉化安装状态:shim/packs 是否就位,cmd 是否被改,用户配置等。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      handleRequest(JSON.parse(line));
    } catch (e) {
      log("malformed request:", e.message);
    }
  }
});

function send(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

function handleRequest(req) {
  const { id, method, params } = req;
  switch (method) {
    case "initialize":
      send(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "mcode-cli-zh", version: PLUGIN_VERSION },
        capabilities: { tools: {} },
      });
      break;
    case "notifications/initialized":
      // no response
      break;
    case "tools/list":
      send(id, { tools: TOOLS });
      break;
    case "tools/call":
      try {
        const { name, arguments: args = {} } = params || {};
        let result;
        switch (name) {
          case "install": result = install(); break;
          case "uninstall": result = uninstall(); break;
          case "switch": result = switchLang(args); break;
          case "translate": result = setEnabled(args); break;
          case "status": result = getStatus(); break;
          default: return sendError(id, -32602, `Unknown tool: ${name}`);
        }
        send(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        sendError(id, -32603, e.message);
      }
      break;
    default:
      if (id !== undefined) sendError(id, -32601, `Method not found: ${method}`);
  }
}
