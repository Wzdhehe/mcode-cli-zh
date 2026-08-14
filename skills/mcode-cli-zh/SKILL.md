---
name: mcode-cli-zh
description: 当用户要求查询、切换、加翻译、调试或回滚 mcode CLI 的中英文显示语言时,使用本 Skill。通过 MCP 工具 (install / uninstall / switch / status) 和字典包管理提供完整工作流。
---

# mcode CLI 汉化(产品化版本,自带翻译数据)

本 Plugin 自带 i18n-shim + 3 个内置字典包,**装上即自动安装到用户的 mcode CLI**,别人从市场下载也能用。

## 触发场景

- "帮我装 mcode 汉化" / "mcode 汉化一下"
- "把 mcode 切到英文" / "切回中文"
- "mcode 当前用的什么语言"
- "**关掉 mcode 汉化翻译**" / "**关翻译**" / "**关掉汉化**"
- "**打开 mcode 汉化翻译**" / "**开翻译**" / "**开启汉化**"
- "禁用 i18n-zh-CN 字典包" / "启用 xxx 字典包"
- "加一条翻译: 'Permission denied' → '权限被拒绝'"
- "mcode 汉化没生效,看看哪有问题"
- "回滚 mcode 汉化" / "卸载 mcode 汉化"
- "列一下当前加载的字典包"

## 快速通道(按用户消息给路径)

> **Mavis 拿到本 SKILL 后,优先看这一段**——按用户消息直接选工具,不要先全表扫。

| 用户说 | 直接调 |
|---|---|
| "开/关翻译"、"打开/关掉汉化"、"翻译生效吗" | `translate({on: true / false})` |
| "切到英文/中文"、"切回中文" | `switch({locale: "en" / "zh-CN"})` |
| "mcode 汉化没生效"、"看看现在什么状态" | `status()` |
| "装一下"、"重装"、"修复" | `install()` |
| "卸载/回滚" | `uninstall()` |
| "加一条翻译: 'X' → 'Y'" | 改 dict.json(看下面 §4) |
| "禁用/启用某个字典包" | 改 `~/.mcode/config.json` 的 `packs.disabled` |

**判断原则**:
- 用户要"开关/切换"操作 → **直接调对应工具**,**不要先 `status()` 看看**(用户没问状态就别多此一举)
- 用户说"看看现在什么"、"诊断" → 调 `status()`
- 用户场景不明确 → 先 `status()` 看现状,再决定调什么

## 翻译开关(独立于 language)

`translate(on/off)` 工具控制翻译是否生效,跟 `switch(locale)` 是两件正交的事:

| 状态 | `language: zh-CN` | `language: en` |
|---|---|---|
| `enabled: true` (默认) | 翻译 | 不翻译(走原版) |
| `enabled: false` | 不翻译(shim 早退) | 不翻译 |

**用户场景**:
- "想看原版英文又不想动 mcode" → `translate(false)`,locale 仍 zh-CN,下次启动 mcode 显示英文
- "想把所有翻译关掉" → `translate(false)`
- "重新打开翻译" → `translate(true)`

shim 启动时第一件事就是读 `config.enabled`,false 就直接早退,连字典都不读。

## 核心机制(用户视角)

mcode 的汉化是 **i18n-shim + 字典包系统**:

- **shim**:Node ESM 注入,hook 住 `String.replaceAll` / `console.*` / `process.stdout.write` 做翻译替换
- **字典包**:JSON 文件,`{英文: 中文}` 一条条对应;3 个内置 + N 个用户级
- **locale 优先级**:`MCODE_LOCALE` env > `--lang` CLI > `~/.mcode/config.json` > 系统 `LANG` > `en`

本 Plugin 的 **MCP 服务器**(`server.js`)在用户安装 Plugin 时**自动运行 install**,把 shim + 字典包复制到用户的 mcode 安装目录,改 `mcode.cmd` 注入 `--import i18n-shim.mjs`,备份原 `.cmd` 到 `.cmd.bak`。**用户不需要手动操作**。

## 关键路径(Plugin 视角)

```
C:\Users\<user>\.minimax\plugins\mcode-cli-zh\   ← 本 Plugin 目录
├── i18n-shim.mjs                                ← shim 本体(bundled,v0.4.0 加了 enabled 开关)
├── i18n-packs\                                  ← 3 个内置字典包
│   ├── i18n-zh-CN\                              ← 通用文案(TUI/权限/错误)
│   ├── cli-help-zh-CN\                          ← CLI help 文本
│   └── example-zh-CN-fixes\                     ← 示例包(用户可复制)
├── mcode.ps1                                    ← PowerShell 启动器模板
├── server.js                                    ← MCP 服务器
└── skills\mcode-cli-zh\SKILL.md

# 装上 Plugin 后,会被复制到 mcode 安装目录:
<mcode-dir>\
├── mcode          (POSIX shell 启动器,原版备份为 .bak,新版本含 --import)
├── mcode.bak      (shell 启动器原版备份,回滚用)
├── mcode.cmd      (cmd.exe 启动器,原版备份为 .cmd.bak,新版本含 --import)
├── mcode.cmd.bak  (cmd.exe 启动器原版备份,回滚用)
├── mcode.ps1      (PowerShell 启动器模板,新建)
├── i18n-shim.mjs
└── i18n-packs\... (从 Plugin 复制)

# 用户级配置:
%USERPROFILE%\.mcode\
├── config.json     ({ language, enabled })     ← v0.4.0 起多了 enabled 字段
├── i18n-packs\     (用户级字典包,跨升级存活)
└── logs\
    ├── i18n.log            (shim 漏译记录)
    └── mcode-cli-zh.log    (本 Plugin 的 install/uninstall/switch/translate 日志)
```

## 硬性约束(Mavis 必须遵守)

- ❌ **不要调 `mcode update` / `mcode login` / `mcode provider add`**(改远程状态)
- ❌ **不要改 `node_modules\@minimax-ai\code\`** 下任何文件(npm 升级会覆盖 + 签名校验)
- ❌ **不要在 mcode 进程跑着的时候改 `dict.json`**(运行中改会被覆盖)
- ❌ **不要让用户手动删 `mcode.cmd.bak`**(回滚用)
- ❌ **不要硬装一个"中文"就完事**——必须走 MCP 工具的 `install` / `switch`,否则下次启动被覆盖

## 已知坑:mcode 启动器不止一个!

`mcode` 装在非默认位置时,目录里通常有**三个**启动器:
- `mcode`(POSIX shell 脚本,`#!/bin/sh`)— `where mcode` 找到的第一个
- `mcode.cmd`(cmd.exe 启动器)— **Windows 上 PowerShell/cmd 默认走这个**(`Get-Command mcode` 验证)
- `mcode.ps1`(PowerShell 启动器)

`where mcode` 输出顺序是先 shell 脚本,后 .cmd。但 PowerShell 跑 `mcode` 时,只识别 `mcode.cmd`(不识别无扩展名的 `mcode`)。所以:

- **Windows 上**:改 `mcode.cmd` 才是翻译生效的关键
- **macOS / Linux 上**:改 `mcode` shell 脚本

`install` 工具**会同时改三个**(shell + cmd + ps1),所以正常 install 不会踩这个坑。但如果手动改,记得三个都改。

## 已知坑:Plugin 禁用 ≠ 卸载!

Plugin 只是**管理者**(装/卸/配置),不是翻译本身。翻译机制(改过的 `mcode.cmd` + shim + 字典包)装在你机器上后,Plugin 启不启用跟翻译没关系。

| 操作 | 影响 |
|---|---|
| 在 Mavis 桌面禁用 Plugin | MCP server 停了,翻译继续生效 |
| 调 `translate({on: false})` | config.json 改 `enabled: false`,下次 mcode 启动后翻译关闭 |
| 调 `uninstall()` | 恢复 mcode.cmd + 删 shim + 删 packs,翻译彻底没了 |

用户经常误以为"禁用 Plugin = 翻译关闭",但实际上**不是**。如果用户想关翻译,要让他们先**重新启用 Plugin** → 调 `translate(false)` 或 `uninstall` → 重启 mcode。

## 已知坑:Plugin 不可用时,直接改 config.json

**场景**:用户问"翻译没生效/翻译是开的还是关的",但当前 session 的工具列表里**没有 `mcode_i18n_*`**(Plugin 禁用、marketplace 没拉、或者 minimax-code MCP 是 lazy load 等原因)。

**Mavis 容易犯的错**:
1. 反复 `status()` 试探——失败,没有这些工具
2. 跑去读 Plugin 目录、读 config.json,试图"理解"为什么工具不在
3. 给出"请启用 Plugin"的回答——但用户问的是状态,不是问怎么办

**正确做法——直接读 `~/.mcode/config.json`**:
- 翻译开关 = `config.enabled` 字段(`true` / `false` / 缺省 = `true`)
- 当前语言 = `config.language` 字段(`zh-CN` / `en` / 缺省 = `zh-CN`)
- 禁用字典包 = `config.packs.disabled` 数组

```powershell
# 看翻译开关
Get-Content ~/.mcode/config.json | ConvertFrom-Json | Select-Object enabled, language
```

**哪些情况可以直接改 config.json 跳过 Plugin**:
- 用户**只要改 enabled/language/disabled 字段**——直接改,不用调 MCP
- 用户要**重装/修复** shim 或字典包——必须用 Plugin 的 `install()`,**不能**只改 config

**反过来说**:即使 Plugin 不可用,`config.json` 里的 `enabled` 和 `language` 仍生效(mcode 自己读),Plugin 只是负责**写**。**别被"Plugin 禁用"误导**。

## 已知坑:bash 启动器的 file:// URL

修改 `mcode` shell 启动器时,POSIX 风格路径(`/c/Users/...`)拼成 `file:///$basedir/...` 是 **4 个斜杠**,Node 拒绝(必须 `file:///C:/...` 3 斜杠 + 盘符)。

**正确做法**:用 `cygpath -w` 把 `$basedir` 转为 Windows 路径,再构造 URL:

```sh
case `uname` in
    *CYGWIN*|*MINGW*|*MSYS*)
        if command -v cygpath > /dev/null 2>&1; then
            basedir=`cygpath -w "$basedir"`
        fi
    ;;
esac
shim_url="file:///${basedir//\\/\/}/i18n-shim.mjs"
```

`mcode.cmd` 用 `file:///%dp0%\i18n-shim.mjs`(反斜杠)Node 也接受,所以**Windows 上一般不踩这个坑**(走 `mcode.cmd` 就行)。

## 工作流

### 0. 探测 mcode 位置失败?(最常见的坑)

`install` / `status` 默认通过以下顺序探测 mcode 位置(v0.6.0+):
1. **上次记住的路径**(`~/.mcode/.i18n-mcode-dir`,装过一次就一劳永逸)
2. `where mcode`(Windows) / `which mcode`(Unix)
3. `npm root -g` + 检查 `<globalRoot>/@minimax-ai/code/cli.js`
4. 常见自定义位置:`~/.minimax-code/`、`~/mcode/`、`~/.mcode/mcode/`
5. `MCODE_DIR` 环境变量

**如果 mcode 装在非标准位置**:`status` 返回 `mcodeInstalled: false`。

**手动指定路径**(任意一个工具都接受):
```
mcode_i18n_status(mcodeDir="C:\\Users\\<user>\\.minimax-code")
mcode_i18n_install(mcodeDir="C:\\Users\\<user>\\.minimax-code")
```

**装过一次后会记住路径**——下一次再调 `status` / `install`,不用再传 `mcodeDir`,Plugin 自动用上次的路径。

### 1. 翻译开关(独立于语言)

**调 MCP 工具 `translate`**:
```
mcode_i18n_translate(on=true | false)
```

**结果**:`~/.mcode/config.json` 的 `enabled` 字段被更新。**告诉用户重启 mcode 生效**。

> ⚠️ **不要先 `status()` 看看**。用户说"开/关翻译"就是要操作,直接调 `translate()`,省一次工具调用。只有用户**主动问"现在翻译是开的还是关的"**才用 `status()`。

**典型场景**:
- "关掉翻译" → `translate(false)`
- "开翻译" → `translate(true)`
- "翻译是开的还是关的" → `status()` 看 `translationEnabled` 字段

### 2. 切语言(独立于翻译开关)

**调 MCP 工具 `switch`**:
```
mcode_i18n_switch(locale="en" | "zh-CN" | "zh-TW")
```

**结果**:`~/.mcode/config.json` 的 `language` 字段被更新。**告诉用户重启 mcode 生效**。

**如果用户要"临时试一下,不写文件"**:
- 临时方法:`$env:MCODE_LOCALE="en"; mcode --help`(只对当前 shell 会话)
- 临时方法二:`mcode --lang en --help`(只对当前命令)
- 这两种不走 MCP 工具,Mavis 可以直接跑命令

### 3. 看状态

**调 MCP 工具 `status`**:
```
mcode_i18n_status()
```

**结果**:返回 JSON,告诉用户:
- `mcodeInstalled` / `mcodeDir` — mcode 是否安装
- `shimInstalled` / `packsInstalled` — Plugin 内容是否就位
- `cmdModified` / `cmdBackupExists` — mcode.cmd 状态
- `translationEnabled` — 翻译开关(默认 true)
- `userLanguage` — 当前 language
- `userConfig` — 完整 config.json

### 4. 加翻译

**这是 Skill 工作流**(MCP 没单独做 `translate-add`,因为改 dict.json 走 Skill 更轻量):

1. 选字典包:
   - **通用 UI 短语**(Loading、Thinking、Allow once 等)→ `i18n-zh-CN/dict.json`
   - **CLI help 文案**(Usage、Options、Commands 等)→ `cli-help-zh-CN/dict.json`
   - **个人补丁**(不想改内置)→ 用户级新字典包
2. 改 `<mcode-dir>\i18n-packs\<pack-id>\dict.json`,加 `"英文原文": "中文翻译"` 一条
3. 验证:`MCODE_I18N_DEBUG=1 mcode --help 2>&1 | Select-String "dict loaded"` 看新条目
4. **重启 mcode 生效**

**注意**:
- 改完 mcode **必须重启**才生效(shim 启动时读一次 dict)
- 内置字典包在 `<mcode-dir>\i18n-packs\`,改后下次 `mcode update` 可能被覆盖 → **个人补丁建议放用户级**(在 `~/.mcode/i18n-packs/`)

### 5. 字典包管理

**列已加载的字典包**(看 `pack.json`):

内置:`<mcode-dir>\i18n-packs\*\pack.json`
用户级:`~/.mcode\i18n-packs\*\pack.json`(如存在)

**禁用某个字典包**(不走 MCP,直接改 config):
```json
// ~/.mcode/config.json
{
  "language": "zh-CN",
  "packs": { "disabled": ["i18n-zh-CN"] }
}
```
**重启 mcode 生效**。

**新增字典包**(用户级,跨升级存活):

1. 创建目录:`~/.mcode/i18n-packs\<新 pack-id>\`
2. 写 `pack.json`:
```json
{
  "id": "<新 pack-id>",
  "name": "我的补丁包",
  "version": "0.1.0",
  "type": "i18n",
  "locale": "zh-CN",
  "description": "...",
  "author": "...",
  "hooks": ["dict"]
}
```
3. 写 `index.mjs`:
```js
export default {
  activate(ctx) {
    if (ctx.locale !== "zh-CN") return;
    if (typeof ctx.registerDict !== "function") return;
    ctx.registerDict({
      source: "pack:<新 pack-id>",
      path: new URL("./dict.json", import.meta.url).pathname,
    });
  }
};
```
4. 写 `dict.json`:`{ "英文": "中文", ... }`
5. **重启 mcode 生效**

### 6. 调试(汉化没生效时)

**打开 shim 调试日志**:
```powershell
$env:MCODE_I18N_DEBUG = "1"
mcode --help 2>&1
```
看 stderr,关键行:
- `[i18n-shim] locale from <来源>: <locale>` — locale 探测
- `[i18n-shim] active locale: <locale> disabled packs: [...]` — 总体状态
- `[i18n-shim] dict loaded: pack:<id> from <path>` — 字典包加载
- `[i18n-shim] dict total entries: <N>` — 字典条目数
- `[i18n-shim] hook installed: ...` — 三个 hook 装上

**看漏译**:
```powershell
Get-Content ~/.mcode/logs/i18n.log -Tail 50
```

**看本 Plugin 的 install 日志**:
```powershell
Get-Content ~/.mcode/logs/mcode-cli-zh.log -Tail 20
```

**完整排错指南**: [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) — 覆盖所有常见问题。

**常见失效原因速查**:
- **完全没有 debug 输出** → shim 根本没加载,`mcode.cmd` 没有 `--import` 行 → 调 `install()`
- `locale fallback to en` + `dict total entries: 0` → `~/.mcode/config.json` 不存在或路径不对 → 调 `install()` 或手动创建
- `mcode update` 升级了 mcode → `mcode.cmd` 被覆盖 → 调 `install()` 重新注入
- dict.json JSON 不合法 → shim 日志 `dict parse failed`
- 用户级字典包 `pack.json` 的 `id` 重复 → shim 跳过
- **`enabled: false` 看不到翻译** → 看 shim 日志 `translation disabled by config`,调 `translate({on: true})` 或删 `enabled` 字段

### 7. 回滚 / 卸载

**调 MCP 工具 `uninstall`**:
```
mcode_i18n_uninstall()
```

**结果**:
- 恢复 `mcode.cmd`(从 `.cmd.bak`)
- 删除 `i18n-shim.mjs`、`i18n-packs/`、`mcode.ps1`
- **保留** `~/.mcode/config.json` 和 `~/.mcode/i18n-packs/`(用户级数据不动)

如果 `.cmd.bak` 不存在(uninstall 自动去掉 `--import`,但 mcode.cmd 的内容是 Plugin 装后的版本),原 mcode.cmd 已经被覆盖,**此时回滚不完整**。建议先备份再 uninstall。

## 用户级 vs 内置字典包(发布翻译的推荐路径)

发布翻译到 Plugin 市场时,**Plugin 自带的字典包是内置的**(装上时复制到 `<mcode-dir>\i18n-packs\`),**用户级字典包是用户自己加的**(在 `~/.mcode/i18n-packs\`,跨升级存活)。

- **Plugin 作者改内置包** → 升级 Plugin 后,所有用户同步收到新翻译
- **用户加补丁** → 走用户级包,Plugin 升级不被覆盖
- **群友贡献翻译** → 复制 `example-zh-CN-fixes/` 改 ID 和 dict.json,作为用户级包

## 兜底话术

如果用户场景超出 shim 能力(比如想翻译 TUI 内部状态、prompt 注入的 `<locale-context>`):

> "这部分在 mcode 自己的 22MB minified bundle 里,shim 只能 hook console/stdout,改不到。你能在 `i18n-zh-CN\dict.json` 里加翻译,但内部状态/AI 行为相关的不在汉化范围。"

## 不要做的事

- ❌ 不要手动 `npm i -g` 或改 `node_modules\@minimax-ai\code\`
- ❌ 不要调 `mcode update` / `mcode login` / `mcode provider add`
- ❌ 不要在 mcode 跑着的时候改 dict.json
- ❌ 不要硬装一个"中文"就完事——必须走 `install` / `switch` MCP 工具
- ❌ 不要让用户把翻译写到 `node_modules\@minimax-ai\code\` 下(npm 会覆盖)
- ❌ 不要告诉用户"禁用 Plugin = 卸载翻译"——这是错的,翻译继续生效。要引导他们用 `translate(false)` 或 `uninstall`
