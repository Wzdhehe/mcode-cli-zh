# mcode-cli-zh

> 让 [MiniMax Code CLI](https://github.com/) (mcode) 说出中文。一个本地 MiniMax Plugin,自带 i18n-shim + 3 个内置字典包,装上即用。

## 这是什么

`mcode-cli-zh` 是一个本地 [MiniMax Code](https://github.com/) Plugin,把 mcode CLI/TUI 的表面文案翻译成简体中文。

- **翻译内容**:`mcode --help`、TUI 启动横幅、状态栏、权限对话框、思考中、加载中等高频短语、错误消息(MCP / 登录 / Provider / 剪贴板 / Session)
- **中英可切换**:`MCODE_LOCALE=en mcode` 回退英文(与原版 byte-for-byte 一致)
- **翻译开关**:`enabled: true/false` 独立于 language,关掉就是英文,不删任何文件
- **自动安装**:Plugin 装上后,MCP server 启动时自动把 shim + 字典包复制到 mcode 目录,改 `mcode.cmd` 注入 `--import i18n-shim.mjs`,备份原 `.cmd` 为 `.cmd.bak`

## 安装(给用户)

1. 把这个仓库内容放到 `~/.minimax/plugins/mcode-cli-zh/`
2. 打开 Mavis(MiniMax Code)桌面,会看到 **mcode CLI 汉化** 卡片
3. 启用 Plugin,**MCP server 启动时自动 install**——不用手动操作
4. 重启 mcode CLI,生效

## 用法(给 Mavis)

启用 Plugin 后,直接对 Mavis 说:

- "帮我装 mcode 汉化"
- "把 mcode 切到英文"
- "**关掉 mcode 汉化翻译**" / "**打开 mcode 汉化翻译**"
- "mcode 当前用的什么语言"
- "加一条翻译: 'Permission denied' → '权限被拒绝'"
- "回滚 mcode 汉化"

背后是 5 个 MCP 工具:`install` / `uninstall` / `switch` / `translate` / `status`。

## 内置字典包

| ID | 用途 |
|---|---|
| `i18n-zh-CN` | 通用文案(TUI 状态、权限、错误、MCP/login/provider) |
| `cli-help-zh-CN` | CLI help 文本(`mcode --help` / `exec --help` / `provider --help`) |
| `example-zh-CN-fixes` | 示例包(可复制为模板,贡献翻译的起点) |

## 字典包优先级

1. `MCODE_LOCALE` 环境变量(如 `zh-CN`, `en`)
2. `mcode --lang <locale>` 命令行
3. `~/.mcode/config.json` 的 `language` 字段(默认 `zh-CN`)
4. 系统 `LANG` / `LC_ALL`(以 `zh*` 开头视为中文)
5. fallback: `en`(不翻译)

## 配置 (`~/.mcode/config.json`)

```json
{
  "language": "zh-CN",
  "enabled": true,
  "packs": { "disabled": [] }
}
```

| 字段 | 含义 | 默认 |
|---|---|---|
| `language` | locale (`zh-CN` / `zh-TW` / `en`) | `zh-CN` |
| `enabled` | 翻译开关(独立于 language) | `true` |
| `packs.disabled` | 禁用的字典包 ID 列表 | `[]` |

## 调试

```powershell
$env:MCODE_I18N_DEBUG = "1"
mcode --help 2>&1
```

漏译在 `~/.mcode/logs/i18n.log`,Plugin 操作日志在 `~/.mcode/logs/mcode-cli-zh.log`。

## 回滚

```powershell
# 调 MCP 工具 uninstall
mcode_i18n_uninstall()
```

恢复 `mcode.cmd`(从 `.cmd.bak`),删除 `i18n-shim.mjs` / `i18n-packs/` / `mcode.ps1`。**保留** `~/.mcode/config.json` 和 `~/.mcode/i18n-packs/`(用户级数据不动)。

## 硬性约束(给贡献者 / Mavis)

- ❌ 不要改 `node_modules\@minimax-ai\code\` 下任何文件(npm 升级会覆盖 + 触发签名校验)
- ❌ 不要调 `mcode update` / `mcode login` / `mcode provider add`
- ❌ 不要在 mcode 进程跑着的时候改 `dict.json`(运行中改会被覆盖)
- ❌ 不要删 `mcode.cmd.bak`(回滚用)

## License

MIT
