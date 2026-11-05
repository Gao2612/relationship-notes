# 维护边界

更新：2026-11-01。

## 运行链路

宿主入口 `index.js` 注册模型/导入等服务；浏览器客户端由 `src/workspace.js` 注册至 DSH 的 `subdsh` 容器。注册 id `relationship-notes` 与 `inject: ['locale', 'subdsh']` 是集成契约，维护时应保持兼容。

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

拆分后 `workspace.js` 648 行 / 175,865 字节 → 624 行 / 166,048 字节。每个模块抽取后均单独跑过 `verify-v3.mjs`（38 个测试文件全绿）。仍有副作用但未拆的候选（宿主档案同步桥、PDF 文本解析）留在 `workspace.js`，因为它们的闭包同时持有渲染期状态，硬拆会改变行为。

## 遗留文件归档

2026-11-01 检查 build、入口、包清单、当前测试及源码引用后，将旧文件移到 `docs/archive/legacy/`：

- `verify.mjs`
- `src/page.js`、`src/workspace.js.before-ui-upgrade`、`src/parser-errors.json`
- `client-shell.js`、`workspace.html`、`adapt.css`、`theme-bridge.js`
- `.timeline-goals-check.mjs`

发现的旧运行引用仅位于过期 `verify.mjs` 自身；`parser-errors.json` 仅由旧的一次性生成器写入。路线图中的文件名是说明文字，不属于运行依赖。归档可逆：按归档目录中的原相对路径恢复即可；恢复前应核对目标不存在，避免覆盖当前代码。归档中的校验/生成器是历史材料，不作为当前构建或测试入口，也不应执行。

2026-11-05 二次归档：根目录历史备份移入 `docs/archive/backups/`（`reply-service.js.before-timeline-fix`、`src/*.before-*`），复审查阅日志移入 `docs/archive/reviews/`（`REVIEW-*.md`），验证日志移入 `docs/archive/logs/`（`*.log`）；设计文档（`CAPTURE-RESEARCH.md`、`FEATURES-3.2.md`、`IMPLEMENTATION-ROADMAP.md`、`IMPORT-QUEUE-DECISION.md`、`MESSAGE-IDENTITY.md`、`PERSISTENCE-MIGRATION.md`、`PROFILE-TOOLS.md`、`THIRD-PARTY-EVALUATION.md`）移入 `docs/`。根目录只保留运行所需文件、测试入口、许可证与 README/CHANGELOG/package/build。

## 一次性迁移工具

旧 `port-engine.mjs` 已移至 `tools/port-engine.mjs`。默认运行直接退出，`--help` 只显示说明。只有显式 `--overwrite` 才考虑执行，且必须同时满足批准原型和当前 engine 的 SHA256 基线。已有手改、缺失原型或基线变化都会中止；不得通过随意更新哈希绕过保护。

工具写入前使用排他文件创建备份到 `tools/backups/`，并再次核对目标未并发变更。错误字符串清单写到 `tools/generated/`，不再制造无运行用途的 `src/parser-errors.json`。备份及生成目录不属于发布源码，发布打包需排除。这是历史迁移工具，正常构建不应调用。

## 检查与发布

当前构建由 `build.mjs` 负责，测试入口为 `verify-v3.mjs`。模块变更要覆盖相应行为；归档只需检查运行引用和构建链路。测试 runner、构建和包清单由主集成任务维护。

发布源码与安装产物应来自同一版本；GitHub 源码不得含真实聊天、本人样例、媒体、备份、凭据及本机日志。归档仅用于保留历史来源，安装包应按 `package.json.files` 的明确清单分发，不把归档当可执行入口。

冻结源码并构建/验证后，可运行 `node tools/package-release.mjs --out <新的交付目录>`。工具按package.files匹配运行文件，并附带package、README、许可证和Markdown说明，排除依赖与历史归档；生成ZIP、SHA256和逐文件清单。已有同名ZIP时拒绝覆盖，源码时间晚于client时要求重新构建。可先加 `--dry-run` 审查文件清单。打包工具依赖Windows PowerShell/.NET压缩库，不是客户端运行依赖。

共享预览由纯模块 `src/share-scope.js` 处理：可选择包含首尾日期的上海时区范围和1–500条上限，日期筛选时排除未知时间，单条仍裁为2000字符；预览不包含消息正文。`createProfileBridgeSnapshot(contact,options)`采用相同范围，默认维持最近500条。日期范围仅作用于聊天消息，当前有效且已确认的档案事实另行共享；界面应明确显示这个区别。
