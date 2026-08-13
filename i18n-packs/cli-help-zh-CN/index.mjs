// 插件: cli-help-zh-CN
// 职责: 把 mcode --help / --help 子命令 等输出翻译为中文。

export default {
  activate(ctx) {
    if (ctx.locale !== "zh-CN") return;
    if (typeof ctx.registerDict !== "function") return;
    ctx.registerDict({
      source: "pack:cli-help-zh-CN",
      path: new URL("./dict.json", import.meta.url).pathname
    });
  }
};