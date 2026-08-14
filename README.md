# mcode-cli-zh

> mcode CLI 简体中文汉化。一个本地 MiniMax Plugin,自带 i18n-shim + 3 个内置字典包,装上即用。

[GitHub 仓库](https://github.com/Wzdhehe/mcode-cli-zh) · [TROUBLESHOOTING](TROUBLESHOOTING.md) · [CONTRIBUTING](CONTRIBUTING.md)

## 这是什么

把 [MiniMax Code CLI](https://github.com/) (mcode) 的表面文案翻译成简体中文：

- `mcode --help` / `mcode exec --help` / `mcode provider --help` 等 CLI 帮助文本
- TUI 启动横幅、状态栏、权限对话框、思考中、加载中等高频短语
- 错误消息（MCP / 登录 / Provider / 剪贴板 / Session）
- 通过字典包系统加载翻译

**支持的操作**：
- 中英文切换（`zh-CN` / `en` / `zh-TW`）
- 翻译开关（独立于语言切换）
- 字典包管理（启用/禁用/新增）
- 翻译条目增删

**特别注意**：本 Plugin 是**翻译管理者**（装/卸/配置），不是翻译本身。翻译机制装在你机器上后，Plugin 启不启用跟翻译没关系。详见 [TROUBLESHOOTING.md#5](TROUBLESHOOTING.md#5-禁用-plugin-后翻译还在)。

## 快速开始

### 给用户（用 mcode）

1. **装 Mavis 桌面**（如果还没装）
2. **装这个 Plugin**：把仓库 clone 到 `~/.minimax/plugins/mcode-cli-zh/`
3. **打开 Mavis**，会看到 "mcode CLI 汉化" 卡片
4. **启用 Plugin** — MCP server 启动时**自动 install**：把 shim + 字典包复制到你的 mcode 目录，改 `mcode.cmd` 注入 `--import`
5. **重启 mcode**，翻译生效

```powershell
# 验证（应该看到中文）
mcode --help
```

### 给 Mavis（让 agent 帮你操作）

启用 Plugin 后，直接对 Mavis 说：

- "帮我装 mcode 汉化"
- "把 mcode 切到英文"
- "**关掉 mcode 汉化翻译**" / "**打开 mcode 汉化翻译**"
- "mcode 当前用的什么语言"
- "加一条翻译: 'Permission denied' → '权限被拒绝'"
- "回滚 mcode 汉化"

背后是 5 个 MCP 工具：`install` / `uninstall` / `switch` / `translate` / `status`。

> ⚠️ `switch` / `translate` 改的是 `~/.mcode/config.json`，**重启 mcode 才生效**，不是热切换。临时试一下用 `$env:MCODE_LOCALE="en"; mcode --help` 或 `mcode --lang en --help`，只对当前命令立即生效。

## 当前覆盖

v0.7 已翻译的 mcode 屏（按用户实测顺序）：

| 屏 / 命令 | 覆盖范围 |
|---|---|
| `mcode --help` / 各子命令 --help | CLI help 文本（cli-help-zh-CN） |
| TUI 启动首屏 | Tips / What's new / Ready 状态 |
| TUI 状态栏 | Ready / Completed / 实时 LIVE / focused details |
| TUI 输入框 | Enter send / Shift+Enter newline / Esc to close / @ file |
| 权限对话框 | AUTO/自动授权 / ASK / FULL / Allow once / Always allow / Deny |
| `/model` 命令 | Available models / ↑↓ select · ←/→ thinking · enter apply · esc cancel |
| `/providers` 命令 | Providers / Models / Add custom / API key 配置 |
| `/providers` 二级 | Configure MiniMax API Key / Saved locally / enter save and use |
| `/help` 命令 | 键盘快捷键 + 斜杠命令 + Esc 关闭 + ↑↓/PgUp/PgDn 滚动 |
| 模型生成中状态栏 | ⚡ ~132.0 tok/s · Enter 排队 · Ctrl+X 引导 · Ctrl+O 详情 · Esc 停止 |
| MCode status 屏 | Directory / Branch / Worktree / Session ID / Title（保留蓝色 section header 英文） |
| 错误消息 | MCP / 登录 / Provider / 剪贴板 / Session 等 |

**总字典条目 ~250+**（3 个内置 pack 合并：i18n-zh-CN + cli-help-zh-CN + example-zh-CN-fixes）。

## v0.7 改进（相对于 v0.6）

**修 bug**：
- 移除 `"No"` / `"select"` / `"Selection"` 等 2-3 字符短 key —— 之前会把 "Not" 切成"否t"、"selection" 切成"选择ion"（半翻译残渣）
- 修 "Esc to close" ANSI 拆分 bug —— mcode 给 "to close" 单独反白导致 substring 切不开，加 `" to close"` + `"to close"` 双 key 绕过
- "存储" 改为"保存"（机翻味重）

**新增翻译**：
- 完整短句风格翻译快捷键提示（"按 Enter 发送排队消息"、"按 Esc 停止" 等），而非裸键名
- /model 屏底部、/help 屏底部、/providers 屏、welcome 屏、MCode status 屏全部覆盖
- 完整 6 句首屏提示 + What's new + 模型生成状态栏
- Enter 快捷键说明："发送消息；如工作中则排队"（比原"发送;MCode 工作时会接着发"清楚）

**SKILL.md 改进**（基于 AI 反馈）：
- 加"快速通道"段：按用户消息类型给路径（开/关/切/查/装/卸），而非按工具列表
- translate 工具说明：明确"开关类操作直接调，不要先 status()"
- 加"Plugin 不可用时 fallback"段：直接读/改 `~/.mcode/config.json` 的 `enabled` / `language` / `packs.disabled` 三个字段，绕过 MCP
- 强化"Plugin 禁用 ≠ 卸载"：用户级 config 仍生效，Plugin 只负责写

## 安装位置

**默认（标准 npm global 安装）**：
- Windows: `%APPDATA%\npm\` 或 `%LOCALAPPDATA%\npm\`
- macOS / Linux: `npm root -g` 的输出

Plugin 启动时**自动探测**这两个位置。如果你的 mcode 装在别处（比如 `~/.minimax-code/`），调 install 时传 `mcodeDir`：

```
mcode_i18n_install(mcodeDir="<你的 mcode 安装目录>")
```

或者把 mcode 所在目录加到系统 `PATH`，重启 Mavis 让 MCP server 重启探测。

## mcode 启动器说明

mcode 安装目录下通常有**三个**启动器：

| 文件 | 用途 | Windows 上谁调它 |
|---|---|---|
| `mcode` | POSIX shell 脚本 | **不调**（Windows 不识别无扩展名） |
| `mcode.cmd` | cmd.exe 启动器 | **PowerShell / cmd 默认调它** |
| `mcode.ps1` | PowerShell 启动器 | 显式调或别名时 |

**Windows 上**：`Get-Command mcode` 返回 `mcode.cmd`。所以**改 `mcode.cmd` 才是 Windows 翻译生效的关键**。Plugin 的 `install` 工具会**同时改三个**（cmd + shell + ps1），但 Windows 上只要 `mcode.cmd` 改对就生效。

## 卸载

**方法 A：用 Plugin 工具**（推荐）

```
mcode_i18n_uninstall()  # 恢复 mcode.cmd + 删 shim + 删 packs
```

**方法 B：手动 PowerShell**

```powershell
# 1. 恢复 mcode.cmd（原版备份）
Copy-Item 'C:\Users\<user>\.minimax-code\mcode.cmd.bak' 'C:\Users\<user>\.minimax-code\mcode.cmd' -Force

# 2. 删 shim + packs + 用户配置
Remove-Item 'C:\Users\<user>\.minimax-code\i18n-shim.mjs' -Force
Remove-Item 'C:\Users\<user>\.minimax-code\i18n-packs\' -Recurse -Force
Remove-Item 'C:\Users\<user>\.mcode\config.json' -Force
```

## 调试

```powershell
$env:MCODE_I18N_DEBUG = "1"
mcode --help 2>&1
```

漏译在 `~/.mcode/logs/i18n.log`，Plugin 操作日志在 `~/.mcode/logs/mcode-cli-zh.log`。

**翻译不生效？** 看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 一步步排查。

## 硬性约束（给贡献者 / Mavis）

- ❌ 不要改 `node_modules\@minimax-ai\code\` 下任何文件（npm 升级会覆盖 + 触发签名校验）
- ❌ 不要调 `mcode update` / `mcode login` / `mcode provider add`（改远程状态）
- ❌ 不要在 mcode 进程跑着的时候改 `dict.json`（运行中改会被覆盖）
- ❌ 不要删 `mcode.cmd.bak`（回滚用）

## 贡献

想加翻译？看 [CONTRIBUTING.md](CONTRIBUTING.md)。流程很简单：改 `dict.json` → 重启 mcode → 验证 → 提 PR。

## 仓库结构

```
mcode-cli-zh/
├── .minimax-plugin/
│   └── plugin.json              ← Plugin manifest
├── icon.png
├── i18n-shim.mjs                ← shim 本体（带 enabled 开关）
├── i18n-packs/
│   ├── i18n-zh-CN/              ← 通用字典
│   ├── cli-help-zh-CN/          ← CLI help 文本
│   └── example-zh-CN-fixes/     ← 示例/模板（贡献者参考）
├── mcode.ps1                    ← PowerShell 启动器模板
├── server.js                    ← MCP 服务器（5 工具）
├── servers.mcp.json             ← MCP manifest
├── skills/
│   └── mcode-cli-zh/
│       └── SKILL.md             ← Mavis 工作流
├── README.md                    ← 本文件
├── TROUBLESHOOTING.md           ← 排错指南
├── CONTRIBUTING.md              ← 贡献指南
└── .gitignore
```

## License

MIT
