# Troubleshooting

跑 `mcode --help` 还是英文 / 翻译不生效 / 工具报错？来这里查。

## 1. 翻译完全不生效（mcode 输出还是英文）

### 症状
- `mcode --help` 输出英文（"Usage: mcode ..." 而不是 "用法: mcode ..."）
- 开了 `MCODE_I18N_DEBUG=1` 也**没有任何** debug 输出

### 原因
shim 根本没被加载。最常见原因：**mcode.cmd 没有 `--import` 行**。

`mcode` 命令（PowerShell / cmd 下）实际走的是 `mcode.cmd` 这个 cmd.exe 启动器。如果 cmd 文件里没有 `--import i18n-shim.mjs`，Node 直接跑 cli.js，shim 不会加载。

### 诊断
```powershell
# 看 mcode.cmd 末尾的那行,有没有 --import
Get-Content 'C:\Users\mjc39\.minimax-code\mcode.cmd' | Select-Object -Last 1
```

**期望看到**（说明已安装）:
```
endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  --import "file:///%dp0%\i18n-shim.mjs" "%dp0%\node_modules\@minimax-ai\code\cli.js" %*
```

**看到的是**（说明没安装）:
```
endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\node_modules\@minimax-ai\code\cli.js" %*
```

### 修复
调 Plugin 的 `install` 工具：
- 标准位置（`%APPDATA%\npm\` 等）：`mcode_i18n_install()`
- 非标准位置（比如 `~/.minimax-code\`）：`mcode_i18n_install(mcodeDir="<你的 mcode 目录>")`

## 2. `status` 返回 `mcodeInstalled: false`

### 症状
- `mcode_i18n_status()` 返回 `mcodeInstalled: false, mcodeDir: null`
- `mcode` 命令在 PowerShell 里能跑（说明 mcode 装着的）

### 原因
Plugin 的 `detectMcodeDir()` 没找到 mcode 安装位置。它用两条路径：
1. `where mcode` / `which mcode`（依赖 PATH）
2. `npm root -g` + 检查 `<global>/@minimax-ai/code/cli.js`

如果你的 mcode 装在非标准位置（**PATH 里没有**、**不是 npm global**），两条都失败。

### 诊断
```powershell
# 检查 mcode 在不在 PATH
where mcode

# 检查 npm global 位置里有没有
Test-Path "$env:APPDATA\npm\node_modules\@minimax-ai\code\cli.js"
```

### 修复
调 `install` 时传 `mcodeDir`：
```
mcode_i18n_install(mcodeDir="C:\\Users\\<user>\\.minimax-code")
```

或者把 mcode 所在目录加到系统 `PATH`（需重启 Mavis 让 MCP server 重启探测）。

## 3. shim 跑但 locale 走 fallback 到 en

### 症状
- `MCODE_I18N_DEBUG=1 mcode --help 2>&1` 输出：
  ```
  [i18n-shim] locale fallback to en
  [i18n-shim] enabled: true active locale: en disabled packs: []
  [i18n-shim] dict total entries: 0
  [i18n-shim] no translation needed, shim is a no-op
  ```

### 原因
shim 探测 locale 的优先级是：
1. `MCODE_LOCALE` 环境变量
2. `mcode --lang <locale>` 命令行参数
3. `~/.mcode/config.json` 的 `language` 字段
4. 系统 `LANG` / `LC_ALL`
5. fallback: `en`

如果 1-4 都没匹配，shim fallback 到 en，不翻译。

**最常见原因**：`~/.mcode/config.json` 不存在。

### 诊断
```powershell
# 检查 config.json
Test-Path 'C:\Users\<user>\.mcode\config.json'

# 检查内容
Get-Content 'C:\Users\<user>\.mcode\config.json'
```

### 修复
**方法 A**：让 Plugin 帮你创建：
```
mcode_i18n_install()  # install 会确保 config.json 存在
```

**方法 B**：手动创建：
```powershell
# 写入最小配置
$config = @{ language = "zh-CN"; enabled = $true }
$config | ConvertTo-Json | Set-Content 'C:\Users\<user>\.mcode\config.json'
```

**方法 C**：临时试一下（不写文件）：
```powershell
$env:MCODE_LOCALE = "zh-CN"
mcode --help
```

## 4. 翻译生效了但 shim 报 "File URL path must be absolute"

### 症状
- 直接 `node --import "file:///$basedir/i18n-shim.mjs" ...` 报：
  ```
  Error [ERR_INVALID_FILE_URL_PATH]: File URL path must be absolute
  ```

### 原因
POSIX 风格的 `$basedir`（`/c/Users/...`）拼成 `file:///$basedir/...` = `file:////c/Users/...`（**4 个斜杠**）。Node 要求 `file:///C:/Users/...`（3 个斜杠 + 盘符）。

### 修复
**方法 A**：在 `mcode` shell 启动器里用 `cygpath -w` 转 Windows 路径：
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

**方法 B**：用 `mcode.cmd`（cmd.exe 启动器），它用 `file:///%dp0%\i18n-shim.mjs`（反斜杠），Node 也接受。**Windows 上 PowerShell 默认就是调 `mcode.cmd`**，所以一般碰不到这个问题。

## 5. 禁用 Plugin 后翻译还在

### 症状
- 在 Mavis 桌面禁用 "mcode CLI 汉化" Plugin
- 重启 mcode，**翻译还是生效**

### 原因
Plugin 只是**管理者**（负责装/卸），不是翻译本身。翻译机制（shim + 改过的 mcode.cmd + 字典包）装在你机器上后，Plugin 启不启用跟翻译没关系。

```
Plugin 启用 → MCP server 跑 → 可以调工具
Plugin 禁用 → MCP server 停 → 没法调工具，但已经装好的翻译继续生效
```

### 修复
| 想干嘛 | 怎么做 |
|---|---|
| **彻底关翻译，保留 Plugin 文件** | 重新启用 Plugin → 调 `translate({on: false})` → 重启 mcode |
| **彻底卸载（恢复原版 mcode）** | 重新启用 Plugin → 调 `uninstall()` → 重启 mcode |
| **彻底卸载，不通过 Plugin** | 手动跑 PowerShell：恢复 mcode.cmd + 删 shim + 删 packs + 删 config.json |

## 6. mcode 的多个启动器，到底改哪个？

mcode 安装目录下通常有**三个**启动器：

| 文件 | 用途 | Windows 上谁调它 |
|---|---|---|
| `mcode` | POSIX shell 脚本（`#!/bin/sh`） | **不调**（Windows 不识别无扩展名文件） |
| `mcode.cmd` | cmd.exe 启动器 | **PowerShell / cmd 默认调它** |
| `mcode.ps1` | PowerShell 启动器 | 用户主动 `mcode.ps1 ...` 或别名设置时 |

**Windows 上**：`Get-Command mcode` 返回 `mcode.cmd`。所以**改 `mcode.cmd` 才是 Windows 翻译生效的关键**。

**macOS / Linux 上**：改 `mcode` shell 脚本。

Plugin 的 `install` 工具会**同时改三个**，但 Windows 上只要 `mcode.cmd` 改对就生效。

## 7. npm 升级 mcode 后翻译失效

### 症状
- 之前翻译正常
- 跑过 `npm install -g @minimax-ai/code@<new version>` 或 mcode 自动更新
- 翻译没了

### 原因
npm 升级会**覆盖 `mcode.cmd` 和 `mcode`**（重置成原版）。`mcode.cmd.bak` 还在（Plugin 装时备份的）。

### 修复
调 `install` 重新注入 `--import`：
```
mcode_i18n_install()
```

如果你的 mcode 位置变了或参数变了，加 `mcodeDir`。

## 8. shim 跑了但 dict 加载 0 个

### 症状
```
[i18n-shim] enabled: true active locale: zh-CN disabled packs: []
[i18n-shim] dict total entries: 0
[i18n-shim] no translation needed, shim is a no-op
```

### 原因
`<mcode-dir>\i18n-packs\` 目录是空的或者不存在。shim 启动时从这个目录加载字典包。

### 修复
调 `install` 重装字典包：
```
mcode_i18n_install()
```

或者确认 `<mcode-dir>\i18n-packs\` 存在且有 3 个子目录（`i18n-zh-CN` / `cli-help-zh-CN` / `example-zh-CN-fixes`）。

## 9. 漏译（应该翻译的没翻译）

### 诊断
```powershell
# 看漏译日志
Get-Content 'C:\Users\<user>\.mcode\logs\i18n.log' -Tail 50
```

漏译条目长这样：
```
untranslated: Some English Phrase
```

### 修复
加翻译到对应的字典包（参见 [CONTRIBUTING.md](CONTRIBUTING.md)）。

## 10. Plugin 跟别的 MCP/Plugin 冲突

如果你的桌面装了多个 mcode/i18n 相关的 Plugin，可能 shim 会被加载多次。检查：

```powershell
# 看有几个 mcode 启动器被改了
Get-ChildItem 'C:\Users\<user>\.minimax-code\mcode*.cmd*' | Select-Object Name
```

如果有多个 `.cmd.bak`，说明 mcode.cmd 被多次修改。建议保留**最早**的 `.cmd.bak` 作为原版，其它 `.cmd.bak` 可以删了。

## 11. 看完整 debug

任何问题，开 debug 跑一遍：

```powershell
$env:MCODE_I18N_DEBUG = "1"
mcode --help 2>&1
```

输出包括：
- `[i18n-shim] locale from <来源>: <locale>` — locale 怎么来的
- `[i18n-shim] active locale: <locale> disabled packs: [...]` — 最终状态
- `[i18n-shim] dict loaded: pack:<id> from <path>` — 每个 pack 加载情况
- `[i18n-shim] dict total entries: <N>` — 总字典条目数
- `[i18n-shim] hook installed: ...` — hook 装上

如果**完全没有** debug 输出，说明 shim 根本没被加载（看 #1）。

漏译在 `~/.mcode/logs/i18n.log`，Plugin 操作日志在 `~/.mcode/logs/mcode-cli-zh.log`。
