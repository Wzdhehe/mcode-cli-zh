// 示例插件:把字典注册给 shim
// 复制本目录、改 plugin.json 的 id、改 dict.json 的内容,就完成一个新插件。

export default {
  activate(ctx) {
    if (ctx.locale !== "zh-CN") return;
    if (typeof ctx.registerDict !== "function") return;
    ctx.registerDict({
      source: "pack:example-zh-CN-fixes",
      path: new URL("./dict.json", import.meta.url).pathname,
    });
  }
};