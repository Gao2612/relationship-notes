# 已知问题

更新：2026-11-05。

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

仍未覆盖：`src/workspace.js` 的大量源码文本断言（`workspace.rendering.test.mjs` 等）使该文件暂不能自动格式化，已列入 `.prettierignore`；把这些断言逐步改写为基于本 DOM 测试的行为断言后，即可移除该例外。
