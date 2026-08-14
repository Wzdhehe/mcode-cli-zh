# Contributing

想给 mcode CLI 汉化添砖加瓦？这份文档告诉你怎么加翻译、怎么贡献新字典包。

## 翻译流程（最常见）

1. 跑 `mcode`，看到英文 UI → 记下原文
2. 选字典包（见下）
3. 改对应 `dict.json`，加 `"英文原文": "中文翻译"` 一条
4. **重启 mcode**，验证生效
5. 提交 PR 或把改好的字典发群

## 字典包选哪个

| 你看到的英文 | 改哪个包 |
|---|---|
| `Loading...` / `Thinking...` / `Allow once` / `Always allow` 等通用 UI 短语 | `i18n-packs/i18n-zh-CN/dict.json` |
| `Usage:` / `Options:` / `Commands:` 等 CLI help 文本 | `i18n-packs/cli-help-zh-CN/dict.json` |
| 不确定是哪个 | 看 [TROUBLESHOOTING.md#9](TROUBLESHOOTING.md#9-漏译应该翻译的没翻译) 里的诊断步骤 |

**不要**改 `i18n-packs/example-zh-CN-fixes/dict.json`——那是给贡献者看的模板示例，不是真用的字典。

## 改 dict.json 的格式

打开 `dict.json`，**按分类加到对应分组**（保持结构整洁）：

```json
{
  "_meta": { ... },                    // 不要动
  "tui_status": { ... },               // TUI 状态
  "permission": { ... },               // 权限对话框
  "errors_session": { ... },           // 会话错误
  "common": { ... }                    // 通用词（Yes / No / Cancel 等）
}
```

**示例**：在 `i18n-zh-CN/dict.json` 的 `common` 分组下加：

```json
{
  "common": {
    "Yes": "是",
    "No": "否",
    "Cancel": "取消",
    "Retry": "重试"           ← 新加的
  }
}
```

保存 → 重启 mcode → 验证。

## 翻译原则

### 1. 简洁
mcode 是 CLI/TUI，**屏幕空间宝贵**。翻译要短，能 2 字不 4 字：
- ✅ `Allow once` → `仅本次允许`
- ❌ `Allow once` → `只允许这一次操作`
- ✅ `Loading...` → `加载中…`
- ❌ `Loading...` → `正在加载中...`

### 2. 一致
同一个英文词在多个地方出现，要用同一个中文翻译：
- `Error:` 在 5 个地方都出现 → 都翻成 `错误:`，不要一会 `错误` 一会 `出错`

### 3. 保留技术名词
- `JSON Schema` → 保持 `JSON Schema`（不翻）
- `Runtime init Skill` → 保持 `Runtime init 技能`（Skill 翻成"技能"，Runtime 不翻）
- `TUI` → 保持 `TUI`
- 命令名（`mcode exec`）→ 保持原样

### 4. 标点
- 中文用全角：`，。：；！？`
- 引号用直角引号或半角，**不要**用花引号（控制台渲染会乱）

### 5. 测试
改完一定要重启 mcode 验证。漏译看 `~/.mcode/logs/i18n.log`。

## 新建字典包

要建一个全新的字典包（比如专门翻译某个 mcode 子命令），按 `example-zh-CN-fixes/` 模板复制：

```powershell
# 1. 复制模板
Copy-Item -Recurse 'C:\Users\mjc39\.minimax-code\i18n-packs\example-zh-CN-fixes' 'C:\Users\mjc39\.mcode\i18n-packs\my-pack-zh-CN'

# 2. 改 pack.json 的 id/name/description
# 3. 改 dict.json 加你的翻译
# 4. 重启 mcode
```

或加到内置包（要发 PR）：
1. 在 `i18n-packs/<新包名>/` 下创建 `pack.json` + `index.mjs` + `dict.json`
2. 参照 `i18n-zh-CN` 模板
3. 提交 PR

## 调试翻译

```powershell
# 开 debug
$env:MCODE_I18N_DEBUG = "1"
mcode --help 2>&1
```

看 `dict loaded: pack:<id> from <path>` 行——每个 pack 是否加载、加载了多少条目。

漏译看 `~/.mcode/logs/i18n.log`，格式：
```
untranslated: Some English Phrase
```

## 提交格式

提交到内置字典包的 PR：
- 文件位置：`i18n-packs/<pack-id>/dict.json`
- 一次只改一个分组（或加一个分组）
- commit message：`i18n(<pack-id>): 翻译 <场景>`，例 `i18n(i18n-zh-CN): 翻译 Login 流程错误`

贡献到用户级字典包（无需 PR）：
- 用户级目录：`~/.mcode/i18n-packs/<your-pack>/`
- Plugin 升级不会被覆盖，跨升级存活

## 提交流程（贡献给内置）

1. Fork https://github.com/Wzdhehe/mcode-cli-zh
2. 在 `i18n-packs/<pack>/dict.json` 加翻译
3. `git diff` 看清楚改了什么
4. 开 PR，标题：`i18n(<pack>): <描述>`
5. 等 review / merge

## 不要做的事

- ❌ 不要改 `node_modules/@minimax-ai/code/` 下任何文件（npm 升级会覆盖 + 触发签名校验）
- ❌ 不要在 mcode 进程跑着的时候改 `dict.json`（运行中改会被覆盖）
- ❌ 不要把翻译写到内置 `dict.json` 的 `_meta` 段（会被 shim 跳过）
- ❌ 不要新建跟现有 ID 重复的字典包（shim 会跳过）
- ❌ 不要在 PR 里改 mcode.ps1 / mcode.cmd / server.js（这些是 Plugin 内部实现，由维护者改）
