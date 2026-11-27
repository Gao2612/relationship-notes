# 维护边界

更新：2026-11-19。

## 运行链路

宿主入口 `index.js` 注册模型/导入等服务；浏览器客户端由 `src/workspace.js` 的 `mountWorkspace` 挂载：

- 顶层只声明 `inject: ['locale']`。cordis 4.1 的注入全部是必需项，若把 `subdsh` 列在顶层，没有该容器的宿主（npm 公开版 `@deepseek-ai/dsh` Web）会停在 “Failed to load plugins”，整个 DSH 无法使用（2026-11-16 在 0.2.2-rc.1 实测）。
- `ctx.inject(['subdsh'], …)`：宿主提供 `subdsh` 时注册 id `relationship-notes`、label、order 20 的子页面，与此前完全一致。
- 宿主没有 `subdsh` 时，`ctx.inject(['slots'], …)` 在原生侧栏注册 `sidebar.panellist` + `main` 面板（id 同为 `relationship-notes`）；若 `subdsh` 稍后出现，退路面板会被释放，避免出现两个入口。仍然禁止接管 `sidebar.workspaces`（`verify-v3.mjs` 检查）。
- 宿主上下文不支持 `ctx.inject` 时（测试替身等），退回直接调用 `ctx.subdsh.register`。

关系分析 v3：纯模块位于 `src/affinity/`（`weekly-signals` 规则层周汇总 → `model` 维度收缩、AI 融合与综合指数 → `longitudinal` 趋势与变化点 → `index` 编排、缓存指纹与解释），宿主路由 `affinity-service.js`，页面 `src/views/relationship-insight.js`。纯模块不发请求；`workspace.js` 的 `runAffinity` 负责逐周调用、取消与保存。设计与研究依据见 [AFFINITY-V3](AFFINITY-V3.md)。

主题：样式中的宿主变量经 `src/host-tokens.js` 的 `adaptHostTokens` 处理，在桌面版的 `--background` 等变量之后补上 Web 版的 `--dsw-alias-*` 令牌，两种宿主的浅色/深色主题都能生效。会话页三栏的响应式状态由纯函数 `src/session-layout.js` 计算，断点与样式中的容器查询一致。

纯模块（解析、评分、档案生命周期、本人表达档案、回复载荷、建议）放在 `src/`，不得自行发送消息、调用宿主或读取操作系统窗口。浏览器资料保存在本机 IndexedDB；模型请求仅由用户触发的流程送往已配置模型。

桌面采集与发送本轮只研究，相关设计见 `CAPTURE-RESEARCH.md`。未来本机适配器应作为独立组件，不应把 Windows 特有依赖引入浏览器纯模块。

## 浏览器客户端分层（2026-11-05）

`src/workspace.js` 只保留页面装配、导航状态与内联样式；有副作用的时序逻辑已抽成独立模块，全部为“工厂函数 + 显式依赖注入”，且**不 import `workspace.js`**，依赖方向单向（`workspace.js → 副作用模块 → 纯模块`）：

| 模块 | 职责 | 依赖方向 |
| --- | --- | --- |
| `src/workspace-persistence.js` | IndexedDB 打开/读写/删除、快照裁剪、配额降级、350ms 防抖保存、写入队列、恢复流程 | 仅依赖注入的 `E`、`store` |
| `src/workspace-import.js` | 宿主导入队列轮询（3s）、去重、落盘后再 ack、失败重试 | 依赖注入的 `E`、`store`、`set`、`persistence` 与草稿回调 |
| `src/workspace-media.js` | objectURL 注册表（每 File 一个 URL）、媒体类型判定、导出的下载 URL 回收 | 无内部依赖 |
| `src/host-api.js` | 宿主请求适配：API 前缀、JSON POST 报文、keepalive 标志 | 无内部依赖 |

拆分时 `workspace.js` 648 行 / 175,865 字节 → 624 行 / 166,048 字节，每个模块抽取后均单独跑过 `verify-v3.mjs`（当时 38 个测试文件全绿）；之后随关系分析 v3 增长到 722 行 / 约 182KB；2026-11-19 用 Prettier 格式化后为 5,536 行（逻辑不变）。仍有副作用但未拆的候选（宿主档案同步桥、PDF 文本解析）留在 `workspace.js`，因为它们的闭包同时持有渲染期状态，硬拆会改变行为。

## 分析 Web Worker（2026-11-27）

大体量聊天的整段分析（每日历程、会话分析、各时段评分、关系分析、互动评分、关系阶段）在 Web Worker 中预先计算，主线程只读缓存：

| 模块 | 职责 |
| --- | --- |
| `src/analysis-offload.js` | `createAnalysisOffload(E)`：包装 `OPS` 中的纯函数（按参数 / 联系人相关字段的引用做缓存键）、`warm(contact)` 后台预计算、`isReady(contact)`、`computeAsync`、消息精简（`slimMessages`）与结果还原（`rehydrate`，消息副本换回原对象）、Worker 侧 `runWorkerJob` |
| `src/analysis-worker.js` | Worker 入口，只打包分析纯模块；`build.mjs` 构建为压缩字符串 `ANALYSIS_WORKER_SOURCE`（约 51KB），运行时用 Blob URL 启动（与 PDF Worker 相同） |

构建产物 `client.js` 去空白并简化语法、保留标识符（约 2.5MB）；PDF.js 经动态 `import()` 在第一次导入 PDF 时才初始化（`loadPDFJS`）。

- `createPlugin` 一开始把 `E` 换成 `offload.engine`；所有视图与组件照旧同步调用。缓存命中直接返回，未命中时在主线程当场计算，结果始终正确。
- 消息数 ≥ 3000 且 Worker 可用时，`Page` 在渲染后 `warm` 当前联系人（含来源筛选后的视图）；完成前「记录与评分」与「关系阶段」显示“正在后台分析”，页头脉搏图暂不显示，会话中的每日分数暂空，导入结果页显示“正在统计”。其他页面照常可用。
- 只有 AI 周评定（`affinityV3`）、关系画像或每日总结变化时，先返回同一份聊天上次的结果并在后台重算（stale-while-revalidate），存入每周 AI 结果时页面不会回到等待状态。
- Worker 不可用（测试、jsdom、宿主 CSP 禁止 blob Worker）或运行出错时自动退回主线程同步计算。
- 每个 `OPS` 条目的依赖字段已按实现核对：`CORE`（messages / self / target / interactionCorrections），时段与关系分析加 `affinityV3`，关系阶段加 `relationProfile` / `timelineAnalysis`。新增或修改这些函数读取的联系人字段时，必须同步更新 `OPS`。
- 来源筛选后的联系人按（联系人, 来源）缓存（`sourceView`），避免每次渲染新建消息数组让缓存失效。

测试：`src/analysis-offload.test.mjs`（假 Worker，含 esbuild 式只读命名空间）、`analysis-worker-bundle.test.mjs`（执行 `client.js` 内嵌的 Worker 源码）、`workspace-dom-worker.test.mjs`（jsdom 中模拟 Worker，导入 4000 条消息观察等待与完成）。

## 遗留文件归档

2026-11-01 检查 build、入口、包清单、当前测试及源码引用后，将旧文件移到 `docs/archive/legacy/`：

- `verify.mjs`
- `src/page.js`、`src/workspace.js.before-ui-upgrade`、`src/parser-errors.json`
- `client-shell.js`、`workspace.html`、`adapt.css`、`theme-bridge.js`
- `.timeline-goals-check.mjs`

发现的旧运行引用仅位于过期 `verify.mjs` 自身；`parser-errors.json` 仅由旧的一次性生成器写入。路线图中的文件名是说明文字，不属于运行依赖。归档可逆：按归档目录中的原相对路径恢复即可；恢复前应核对目标不存在，避免覆盖当前代码。归档中的校验/生成器是历史材料，不作为当前构建或测试入口，也不应执行。

2026-11-05 二次归档：根目录历史备份移入 `docs/archive/backups/`（`reply-service.js.before-timeline-fix`、`src/*.before-*`），复审查阅日志移入 `docs/archive/reviews/`（`REVIEW-*.md`），验证日志移入 `docs/archive/logs/`（`*.log`）；设计文档（`CAPTURE-RESEARCH.md`、`FEATURES-3.2.md`、`IMPLEMENTATION-ROADMAP.md`、`IMPORT-QUEUE-DECISION.md`、`MESSAGE-IDENTITY.md`、`PERSISTENCE-MIGRATION.md`、`PROFILE-TOOLS.md`、`THIRD-PARTY-EVALUATION.md`）移入 `docs/`。根目录只保留运行所需文件、测试入口、许可证与 README/CHANGELOG/package/build。

2026-11-19 三次清理：删除与 `docs/archive/backups/` 内容相同的 `src/workspace.js.before-timeline-fix`，以及与 `locale/*.json` 内容相同、无引用的 `locale/locale/` 嵌套目录；v2.3 公式图 `好感线索分-数学公式.jpg` 移入 `docs/archive/images/`（仅作历史参考，当前公式见 [AFFINITY-V3](AFFINITY-V3.md)）。

## 一次性迁移工具

旧 `port-engine.mjs` 已移至 `tools/port-engine.mjs`。默认运行直接退出，`--help` 只显示说明。只有显式 `--overwrite` 才考虑执行，且必须同时满足批准原型和当前 engine 的 SHA256 基线。已有手改、缺失原型或基线变化都会中止；不得通过随意更新哈希绕过保护。

工具写入前使用排他文件创建备份到 `tools/backups/`，并再次核对目标未并发变更。错误字符串清单写到 `tools/generated/`，不再制造无运行用途的 `src/parser-errors.json`。备份及生成目录不属于发布源码，发布打包需排除。这是历史迁移工具，正常构建不应调用。

## 检查与发布

当前构建由 `build.mjs` 负责，测试入口为 `verify-v3.mjs`（含真实 DOM 冒烟测试 `workspace-dom.test.mjs`，需先 `pnpm install`）。源码格式由 Prettier 统一（`pnpm run format` / `format:check`，配置见 `.prettierrc.json`），全部源码（含 `src/workspace.js`）均已格式化。测试中的源码文本断言一律经 `src/test-support/compact-source.mjs` 规范化后再匹配，不依赖排版；用户可见行为优先写成真实 DOM 测试（`workspace-dom.test.mjs`、`workspace-dom-behavior.test.mjs`，环境在 `src/test-support/dom-harness.mjs`）。GitHub Actions（`.github/workflows/ci.yml`）在每次推送与 PR 上运行格式检查、构建一致性检查（重新构建后 `client.js` 与 `locale/*.json` 不得有差异）、全部测试和打包预览。模块变更要覆盖相应行为；归档只需检查运行引用和构建链路。测试 runner、构建和包清单由主集成任务维护。

发布源码与安装产物应来自同一版本；GitHub 源码不得含真实聊天、本人样例、媒体、备份、凭据及本机日志。归档仅用于保留历史来源，安装包应按 `package.json.files` 的明确清单分发，不把归档当可执行入口。

冻结源码并构建/验证后，可运行 `node tools/package-release.mjs --out <新的交付目录>`。工具按package.files匹配运行文件，并附带package、README、许可证和Markdown说明，排除依赖与历史归档；生成ZIP、SHA256和逐文件清单。已有同名ZIP时拒绝覆盖，源码时间晚于client时要求重新构建。可先加 `--dry-run` 审查文件清单。打包工具只用 Node.js 内置 `zlib` 写 ZIP（2026-11-19 起不再依赖 Windows PowerShell/.NET），跨平台可用，不是客户端运行依赖。

共享预览由纯模块 `src/share-scope.js` 处理：可选择包含首尾日期的上海时区范围和1–500条上限，日期筛选时排除未知时间，单条仍裁为2000字符；预览不包含消息正文。`createProfileBridgeSnapshot(contact,options)`采用相同范围，默认维持最近500条。日期范围仅作用于聊天消息，当前有效且已确认的档案事实另行共享；界面应明确显示这个区别。
