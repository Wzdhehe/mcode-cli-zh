// mcode 国际化字典包(i18n packs)加载器
// 用法: 由 mcode.ps1 / mcode.cmd 注入为 `node --import ./i18n-shim.mjs ./cli.js ...`
// 默认静默;调试用 `set MCODE_I18N_DEBUG=1` 打开日志(stderr)。
//
// 注意:本项目不是 mcode 官方字典包(ExtensionRegistry),只是借用了"包/字典包"的概念
// 来组织字典文件 — 每个 i18n pack 只是一个 dict.json 文件夹,被加载到全局 DICT
// 用于运行时字符串替换。
//
// 字典包加载流程:
//   1) shim 扫描两个目录,按内置 → 用户顺序加载所有字典包:
//      - 内置: <HERE>/i18n-packs/*/     (与 i18n-shim.mjs 同级)
//      - 用户: ~/.mcode/i18n-packs/*/
//   2) 每个字典包是文件夹,含 pack.json + index.mjs(+ dict.json)
//   3) index.mjs 导出默认对象 { activate(ctx) },ctx 提供:
//        ctx.locale                          当前 locale 字符串
//        ctx.registerDict({ source, path })  注册字典 JSON 文件路径(shim 读 + 展平)
//   4) 字典包可在 activate 里根据 ctx.locale 决定要不要注册(避免污染 en baseline)
//   5) 用户可在 ~/.mcode/config.json 的 packs.disabled 里禁用指定 ID
//
// 安全约束(见 plan §14):
//   - 只做翻译,不做补丁
//   - 不修改 process.argv 之外的进程状态
//   - 不修改 cli.js 的 require.cache
//   - 不调用任何会写远程状态的 mcode 子命令
//   - 默认静默,所有调试日志在 MCODE_I18N_DEBUG=1 时才输出

import { existsSync, readFileSync, readdirSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEBUG = process.env.MCODE_I18N_DEBUG === "1";
const SPY = process.env.MCODE_I18N_SPY === "1";
const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const MCODE_HOME = join(HOME, ".mcode");
const CONFIG_PATH = join(MCODE_HOME, "config.json");
const LOCALES_DIR = join(MCODE_HOME, "locales");
const LOG_PATH = join(MCODE_HOME, "logs", "i18n.log");
const BUILTIN_PACKS_DIR = join(HERE, "i18n-packs");
const USER_PACKS_DIR = join(MCODE_HOME, "i18n-packs");

// ─── 调试日志(默认静默) ─────────────────────────────────────────────────
function dbg(...args) {
  if (!DEBUG) return;
  try { console.error("[i18n-shim]", ...args); } catch { /* swallow */ }
}

// ─── Spy hook: 仅在 MCODE_I18N_SPY=1 时记录 console/stdout 调用字符串 ───
const SPY_LOG_PATH = join(MCODE_HOME, "logs", "i18n-spy.log");
function spyLog(line) {
  if (!SPY) return;
  // 节流:每秒最多 200 条
  if (!spyLog._allow()) return;
  try {
    mkdirSync(dirname(SPY_LOG_PATH), { recursive: true });
    appendFileSync(SPY_LOG_PATH, `${new Date().toISOString()} ${line}\n`, "utf8");
  } catch { /* swallow */ }
}
spyLog._allow = (() => {
  let last = Date.now();
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - last > 1000) { last = now; count = 0; }
    if (count > 200) return false;
    count++;
    return true;
  };
})();

// ─── 漏译记录(节流,只记到文件,不输出到终端) ───────────────────────────
function logMiss(key) {
  if (!key || key.length < 2 || key.length > 500) return;
  if (logMiss._seen.has(key) && Date.now() - logMiss._seen.get(key) < 1000) return;
  logMiss._seen.set(key, Date.now());
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, `untranslated: ${key}\n`, "utf8");
  } catch { /* swallow */ }
}
logMiss._seen = new Map();

// ─── locale 探测(优先级 MCODE_LOCALE > --lang > config.json > LANG > en) ──
function detectLocale() {
  const envLocale = process.env.MCODE_LOCALE;
  if (envLocale && /^[a-z]{2}(-[A-Z]{2})?$/.test(envLocale)) {
    dbg("locale from MCODE_LOCALE:", envLocale);
    return normalizeLocale(envLocale);
  }
  const langIdx = process.argv.findIndex(a => a === "--lang" || a === "--language");
  if (langIdx !== -1 && process.argv[langIdx + 1]) {
    const lc = normalizeLocale(process.argv[langIdx + 1]);
    dbg("locale from --lang:", lc);
    return lc;
  }
  if (existsSync(CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      if (cfg.language && /^[a-z]{2}(-[A-Z]{2})?$/.test(cfg.language)) {
        dbg("locale from config.json:", cfg.language);
        return normalizeLocale(cfg.language);
      }
    } catch { /* ignore */ }
  }
  const sysLang = process.env.LC_ALL || process.env.LANG || "";
  if (/^zh/i.test(sysLang)) {
    dbg("locale from LANG:", sysLang);
    return "zh-CN";
  }
  dbg("locale fallback to en");
  return "en";
}

function normalizeLocale(lc) {
  lc = lc.replace("_", "-");
  if (lc === "zh" || lc === "zh-CN" || lc === "zh-Hans" || lc === "zh-Hans-CN") return "zh-CN";
  if (lc === "zh-TW" || lc === "zh-Hant" || lc === "zh-Hant-TW") return "zh-TW";
  if (lc === "en" || lc === "en-US" || lc === "en-GB") return "en";
  return "en";
}

// ─── 把字典对象展平到目标(跳过 _meta 元数据键) ─────────────────────────
function flattenInto(target, src) {
  if (!src || typeof src !== "object") return;
  for (const [k, v] of Object.entries(src)) {
    if (k === "_meta") continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenInto(target, v);
    } else {
      target[k] = v;
    }
  }
}

// ─── 读取 ~/.mcode/config.json,获取 packs.disabled 列表 ──────────────
function loadDisabledPacks() {
  if (!existsSync(CONFIG_PATH)) return new Set();
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    const list = cfg?.packs?.disabled;
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

// ─── 读取 enabled 开关(默认 true,跟原行为一致) ─────────────────────
function readEnabledFlag() {
  if (!existsSync(CONFIG_PATH)) return true;
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return cfg.enabled !== false;
  } catch {
    return true;
  }
}

// ─── 扫描目录,返回所有字典包目录路径(包含 pack.json 的子目录) ──────
function discoverPackDirs(...roots) {
  const out = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let entries;
    try { entries = readdirSync(root, { withFileTypes: true }); }
    catch { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const dir = join(root, ent.name);
      if (existsSync(join(dir, "pack.json"))) {
        out.push(dir);
      }
    }
  }
  // 按目录名字典序,确保加载顺序稳定(用户级优先于内置?不,反过来,内置先)
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

// ─── 加载单个字典包:读 manifest、import index.mjs、调用 activate ──────
async function loadPack(dir) {
  const manifestPath = join(dir, "pack.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    dbg("pack manifest parse failed:", dir, err.message);
    return null;
  }
  const id = manifest.id || dir.split(/[\\/]/).pop();
  const indexPath = join(dir, "index.mjs");
  if (!existsSync(indexPath)) {
    dbg("pack missing index.mjs:", dir);
    return null;
  }
  let mod;
  try {
    mod = await import(pathToFileURL(indexPath).href);
  } catch (err) {
    dbg("pack import failed:", dir, err.message);
    return null;
  }
  const pack = mod.default || mod.pack || mod;
  if (!pack || typeof pack.activate !== "function") {
    dbg("pack has no activate():", dir);
    return null;
  }
  return { id, manifest, dir, pack };
}

// ─── 全局状态 ──────────────────────────────────────────────────────────
const ENABLED = readEnabledFlag();
const LOCALE = detectLocale();
const DICT = {}; // 合并后的字典 {english: chinese}
const disabled = loadDisabledPacks();

dbg("enabled:", ENABLED, "active locale:", LOCALE, "disabled packs:", [...disabled]);

// ─── 加载所有字典包并执行 activate ──────────────────────────────────────
async function loadAllPacks() {
  // 内置 → 用户:用户字典包后加载,可覆盖内置
  const dirs = [
    ...discoverPackDirs(BUILTIN_PACKS_DIR),
    ...discoverPackDirs(USER_PACKS_DIR),
  ];
  for (const dir of dirs) {
    const loaded = await loadPack(dir);
    if (!loaded) continue;
    if (disabled.has(loaded.id)) {
      dbg("pack disabled by config:", loaded.id);
      continue;
    }
    // 构造 ctx。只提供 registerDict 和 locale ——
    // 字典包 API 保持最小,避免误导。
    const ctx = {
      locale: LOCALE,
      registerDict: ({ source, path }) => {
        // source: 字符串,用于 debug 日志
        // path: 字典 JSON 文件绝对路径
        // Windows: import.meta.url 拿到 file:///C:/...,fileURLToPath 会带 /C:/,existsSync 不认
        // 用 fileURLToPath 还原成正常 Windows 路径
        let realPath = path;
        try {
          if (typeof path === "string" && path.startsWith("file:")) {
            realPath = fileURLToPath(path);
          } else if (typeof path === "string" && /^\/[A-Za-z]:\//.test(path)) {
            // /C:/foo → C:/foo
            realPath = path.slice(1);
          }
        } catch { /* fall through */ }
        if (!realPath || !existsSync(realPath)) {
          dbg("dict path missing:", source, realPath);
          return;
        }
        try {
          const parsed = JSON.parse(readFileSync(realPath, "utf8"));
          flattenInto(DICT, parsed);
          dbg("dict loaded:", source, "from", realPath);
        } catch (err) {
          dbg("dict parse failed:", source, realPath, err.message);
        }
      },
    };
    try {
      await loaded.pack.activate(ctx);
    } catch (err) {
      dbg("pack activate failed:", loaded.id, err.message);
    }
  }
}

// ─── 主流程:enabled 优先,然后 locale 检查 ────────────────────────────
if (!ENABLED) {
  dbg("translation disabled by config (enabled=false), shim is a no-op");
} else {
  await loadAllPacks();
  dbg("dict total entries:", Object.keys(DICT).length);
  if (LOCALE === "en" || Object.keys(DICT).length === 0) {
    dbg("no translation needed, shim is a no-op");
  } else {
    installHooks();
  }
}

// ─── 三层 hook 链 ──────────────────────────────────────────────────────
function installHooks() {
  const origReplaceAll = String.prototype.replaceAll;
  String.prototype.replaceAll = function (search, replacement) {
    if (typeof search === "string" && DICT[search] !== undefined) {
      search = DICT[search];
    }
    return origReplaceAll.call(this, search, replacement);
  };
  dbg("hook installed: String.prototype.replaceAll");

  for (const level of ["log", "info", "warn", "error"]) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      // Spy: 仅在 MCODE_I18N_SPY=1 时记录调用字符串,用于诊断 TUI 是否经过此路径
      if (SPY) {
        for (const a of args) {
          if (typeof a === "string" && a.length > 1) {
            spyLog(`console.${level}: ${a.replace(/\n/g, "\\n").slice(0, 500)}`);
          }
        }
      }
      const translated = args.map(a => typeof a === "string" ? translateLine(a) : a);
      orig(...translated);
    };
  }
  dbg("hook installed: console.log/info/warn/error");

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = function (chunk, encoding, cb) {
    // Spy
    if (SPY && typeof chunk === "string" && chunk.length > 1) {
      spyLog(`stdout.write: ${chunk.replace(/\n/g, "\\n").slice(0, 1500)}`);
    }
    if (typeof chunk === "string" && LOCALE !== "en") {
      const translated = translateChunk(chunk);
      return origStdoutWrite(translated, encoding, cb);
    }
    return origStdoutWrite(chunk, encoding, cb);
  };
  dbg("hook installed: process.stdout.write");
}

// 翻译一个 stdout chunk:整段匹配 → 拆行 → 整行 → 行内子串
function translateChunk(chunk) {
  if (!chunk) return chunk;
  if (DICT[chunk] !== undefined) return DICT[chunk];
  if (!chunk.includes("\n")) return translateLine(chunk);
  const lines = chunk.split("\n");
  for (let i = 0; i < lines.length; i++) {
    lines[i] = translateLine(lines[i]);
  }
  return lines.join("\n");
}

// 剥离 ANSI 转义码(CSI: ESC [ ... letter; OSC: ESC ] ... BEL/ST; 简单 reset/color)
// 用于 TUI 子串匹配时,排除样式干扰
const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[=>]|\x1b\([AB012]/g;
function stripAnsi(s) {
  return s.replace(ANSI_RE, "");
}

function translateLine(line) {
  if (!line) return line;
  if (DICT[line] !== undefined) return DICT[line];

  // 行内子串匹配(从最长到短,避免短串误命中长串)
  // MIN_KEY_LEN 阈值:避免 1-3 字符短词(如 "as"、"to"、"of")误命中代码内部字符串
  // 例外名单 SHORT_KEY_ALLOW:字典作者明确声明这些短词安全,可以参与翻译
  const MIN_KEY_LEN = 4;
  const SHORT_KEY_ALLOW = new Set(["On", "Off", "Yes", "No"]);
  const keys = Object.keys(DICT)
    .filter(k => k.length >= MIN_KEY_LEN || SHORT_KEY_ALLOW.has(k))
    .sort((a, b) => b.length - a.length);
  let out = line;
  // ANSI 转义码剥离:TUI 用 \x1b[7m...\x1b[0m 给每个词包独立样式,中间有 RESET
  // 把行内 ANSI 转义码去掉再做子串匹配,但保留原 chunk 中的 escape(只在子串替换时用 stripped 视图)
  const stripped = stripAnsi(line);
  for (const k of keys) {
    if (!k) continue;
    if (stripped.includes(k)) {
      // 用 stripped 做匹配,但回填到原 line 时,要保留 line 中的 ANSI 样式
      // 简化做法:仅当 stripped 中包含 k 时,直接在 line 中也匹配 k(line 中也有 k 字面量)
      out = out.split(k).join(DICT[k]);
    }
  }

  // 漏译记录(只对带明显 UI 关键词且仍为纯 ASCII 的行)
  if (out === line && /^[A-Za-z0-9 .,/:\-_()'"!?&@#$%^*+=\[\]{}<>]+$/.test(line) && line.length > 5) {
    if (/\b(Usage|Arguments|Options|Commands|Description|Choices|Error|Warning|Failed|Success|Loading|Permission|Session|Model|Provider|Login|Update)\b/.test(line)) {
      logMiss(line);
    }
  }

  return out;
}