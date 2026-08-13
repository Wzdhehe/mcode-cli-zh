// 插件: i18n-zh-CN
// 职责: 注册简体中文字典条目(英文 → 中文)到 shim 的全局 DICT。
// 适用: minimax-code (mcode) CLI/TUI 表面文案
//
// 插件作者不需要懂 shim 源码,只需:
//   1) 修改 plugin.json 里的元数据
//   2) 在 dict.json 里加 `"英文": "中文"` 条目
//   3) 本插件无需改 index.mjs

export default {
  activate(ctx) {
    // 字典在 dict.json,这里只声明要加载的 locale
    if (ctx.locale !== "zh-CN") return;
    if (typeof ctx.registerDict !== "function") return;
    // shim 拿到 dict 路径后,自己读 JSON + 展平 + 合并
    ctx.registerDict({
      source: "pack:i18n-zh-CN",
      path: new URL("./dict.json", import.meta.url).pathname
    });
  }
};