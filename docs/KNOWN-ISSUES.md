# 已知问题

更新：2026-11-19。

## 控制台 `[ui-voice] companion media list failed: TypeError`

**结论：宿主侧问题，不属于关系手记插件；本插件不做任何改动来消除该报错。**

判断依据：

- 在插件源码（`index.js`、`reply-service.js`、`import-service.js`、`profile-service.js`、`interpretation-service.js`、`src/**`、`build.mjs`）中检索 `ui-voice`、`companion`、`media list` 均为 0 命中；构建产物 `client.js` 同样 0 命中。
- 该前缀属于 DSH 自带的实验性语音输入包 `dsh-experimental-client-ui-voice-input`，它被打包在 DSH 应用包 `app.asar` 内（检索 `C:\deepseek\resources\app.asar` 可命中 `ui-voice`，包清单中可见目录名），不在本仓库的依赖树内。
- 本插件只通过 `fetch('api/relationship-notes/...')` 访问宿主路由，并声明 `inject: ['locale']`（`subdsh` 为插件内嵌套注入）；未注册 `ui-voice` 任何能力，也不消费其 media list。
- 因此该 TypeError 由宿主语音输入的 companion 媒体列表读取失败触发（常见于设备/权限/媒体枚举不可用时），属于宿主的容错缺口。

处理建议（由宿主维护方决定，不在本仓库实施）：

1. 在 DSH 的 `ui-voice-input` 侧对 `enumerateDevices` / companion media 查询加 try/catch，失败时静默降级；
2. 或在该功能未启用时跳过 media list 轮询；
3. 若用户不关心语音输入，可在 DSH 设置中关闭该实验功能以消除刷屏。

## 真实 DOM 冒烟测试（2026-11-19 已解决）

此前因无法联网安装 jsdom，回归只有源码断言与纯模块单测。现已加入 `workspace-dom.test.mjs`：devDependencies 新增 `jsdom`、`react`/`react-dom`（18.3.1，与宿主 React 运行时同为 18）和 `fake-indexeddb`，在 jsdom 中用真实 React 渲染构建产物 `client.js`，依次验证：

1. 首屏引导渲染出 `.rnw` 工作区；
2. 载入内置虚构示例 → 选择双方身份 → 导入完成；
3. 联系人、记录与评分（关系分析 / 每日历程 / 互动评分 / 打分依据 / 周月复盘 / 记录列表 / 评分规则）、沟通（会话 / 当前目标 / 进展记录）、设置共 13 个页面均渲染出各自的关键内容；
4. 关闭后在新的页面实例中从 IndexedDB 恢复联系人；
5. 全程没有 React / 控制台错误。

测试不发网络请求（`fetch` 固定返回本地 404），只覆盖渲染装配与主流程，不替代现有行为断言。运行前需 `pnpm install`。

## `src/workspace.js` 不能自动格式化（2026-11-19 已解决）

此前约 130 条测试断言直接用正则匹配 `src/workspace.js` 的源码文本（`workspace.rendering.test.mjs`、`data-expression.test.mjs`、`workspace-theme.test.mjs`、`views/icons.test.mjs`、`session-layout.test.mjs` 与 `verify-v3.mjs`），另有 5 个测试按固定缩进截取函数源码执行，因此该文件只能保持压缩排版并列入 `.prettierignore`。现已：

- 把 DOM 夹具抽成共享的 `test-support/workspace-dom.mjs`（打开/挂载、导入示例或任意文本聊天、按文字点击、键盘与文件输入、`fetch` 替身、IndexedDB 预置快照、焦点断言），把检查用户可见行为的断言改写为真实 DOM 断言；
- 样式规则改为核对插件实际挂载的样式表（导出的 `css` / 页面里的 `<style>`），不再读源码；
- 安全不变量（不用 `localStorage` / `sessionStorage` / `dangerouslySetInnerHTML` / `iframe` / `ctx.styles`、调用 `hostPost` 不预先 `JSON.stringify`）保留为与空白无关的源码检查；
- 截取函数执行的测试改用 `test-support/source-slice.mjs` 按忽略空白的锚点定位；
- 只锁定实现细节的断言（内部变量名、缓存调用方式、具体语句写法）删除。

`src/workspace.js` 已按 `.prettierrc.json` 格式化并移出 `.prettierignore`；重新构建的 `client.js` 经 esbuild 压缩后与格式化前逐字节一致。

## 恢复项目备份失败：`assertStorageSpace is not defined`

**状态：未修复（2026-11-19 由真实 DOM 测试发现）。**

设置 → 备份与恢复 → 选择备份文件 → 「恢复此备份」会显示“恢复失败：assertStorageSpace is not defined”，备份不会被恢复。原因：`src/workspace.js` 中 `Settings` 的 `restoreBackup` 调用了 `assertStorageSpace`，但该函数只定义在 `src/workspace-persistence.js` 的 `createWorkspacePersistence` 闭包里，没有导出到工作区作用域；构建产物 `client.js` 里同样是未定义的全局引用。`src/backup-settings.test.mjs` 截取 `Settings` 源码执行时注入了一个桩 `assertStorageSpace`，所以没有发现。

修复方向：让 `createWorkspacePersistence` 返回 `assertStorageSpace` 并在工作区里解构使用，同时在 `workspace-dom.test.mjs` 增加一条“导出 → 恢复”的真实 DOM 用例。修复会改变 `client.js`，应单独提交。
