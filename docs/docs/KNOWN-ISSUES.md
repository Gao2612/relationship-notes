# 已知问题

更新：2026-11-05。

## 控制台 `[ui-voice] companion media list failed: TypeError`

**结论：宿主侧问题，不属于关系手记插件；本插件不做任何改动来消除该报错。**

判断依据：

- 在插件源码（`index.js`、`reply-service.js`、`import-service.js`、`profile-service.js`、`interpretation-service.js`、`src/**`、`build.mjs`）中检索 `ui-voice`、`companion`、`media list` 均为 0 命中；构建产物 `client.js` 同样 0 命中。
- 该前缀属于 DSH 自带的实验性语音输入包 `dsh-experimental-client-ui-voice-input`，它被打包在 DSH 应用包 `app.asar` 内（检索 `C:\deepseek\resources\app.asar` 可命中 `ui-voice`，包清单中可见目录名），不在本仓库的依赖树内。
- 本插件只通过 `fetch('api/relationship-notes/...')` 访问宿主路由，并声明 `inject: ['locale', 'subdsh']`；未注册 `ui-voice` 任何能力，也不消费其 media list。
- 因此该 TypeError 由宿主语音输入的 companion 媒体列表读取失败触发（常见于设备/权限/媒体枚举不可用时），属于宿主的容错缺口。

处理建议（由宿主维护方决定，不在本仓库实施）：

1. 在 DSH 的 `ui-voice-input` 侧对 `enumerateDevices` / companion media 查询加 try/catch，失败时静默降级；
2. 或在该功能未启用时跳过 media list 轮询；
3. 若用户不关心语音输入，可在 DSH 设置中关闭该实验功能以消除刷屏。

## 未启用自动化 DOM 回归（见交付说明 not_done）

`package.json` 只有 `esbuild` 与 `pdfjs-dist` 两个 devDependency，`node_modules` 中没有 jsdom / happy-dom，且本次任务禁止联网安装依赖，因此没有加入“真实 DOM 冒烟测试”。现有回归仍为源码断言 + 纯模块单测（`verify-v3.mjs`，38 个测试文件）。恢复网络后的建议方案：

1. 在 devDependencies 增加 `jsdom`（或 `happy-dom`），`pnpm install` 写入 lockfile；
2. 新增 `src/workspace.dom.test.mjs`：用 jsdom 提供 `window`/`document`/`indexedDB` 桩，注入最小 `React`（可直接用已打包的 `react` 运行时或手写 `createElement`），断言首屏渲染出 `#rn-panel`、切换到“互动评分”后出现评分节点、切到“设置”后出现备份按钮；
3. 该测试只覆盖渲染装配，不替代现有行为断言。
