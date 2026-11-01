# 3.1 工程复审与整改

日期：2026-11-01。范围：构建、运行入口、测试入口、文档与交付包；不修改业务模块或版本号。

## 已整改

1. **缺少生成产物执行检查**：原 runner 主要通过正则/字符串检查 client.js，有语法正确但 factory 初始化失败的盲区。新增 `bundle-smoke.test.mjs`，在独立 VM 中执行完整生成脚本，捕获真实 ModuleLoader 注册，调用 factory，只允许 require React，再调用插件 apply、实际展开组件并确认容器入口可渲染。另从真实 `index.js` 执行宿主注册，验证路由无重复且工具入口存在。两项通过。
2. **版本锁死测试**：`verify-v3.mjs` 把 package.version 固定断言为3.1.0，发补丁版必然误报。改为校验版本格式并在完成日志显示真实版本；没有修改版本号。
3. **子目录测试遗漏**：原 runner 仅扫描src第一层。改为递归发现src中的测试，并排序执行，后续shared/模块拆分不会默默漏掉测试。

bundle smoke 的边界：使用 React hooks mock，不模拟真实浏览器布局、IndexedDB与异步effect；只模拟 PDF.js 初始化所需的浏览器内建类，未调用媒体解析。它覆盖“产物可执行和挂载”，不能替代 DSH 内真实用户操作。历史渲染/备份测试仍有源码切片与new Function提取，建议逐步迁为导出的纯函数或完整factory行为测试，不为了移除字符串断言而降低现有覆盖。

## 构建复现检查

当前 build 已使用显式ESM与esbuild，不再依赖外部原型文件；本轮连续两次构建产物SHA256相同：`1b6b4583ca87509cdae6afdf163b79e21796eabc4a0734508d485a9e850df35f`。

但同期其他智能体仍在修改src文件，前后源码摘要变化，因此这不是最终冻结版本的可复现性证明。主集成应等所有编辑完成后，重新构建两次、核对SHA256，再生成交付包；不要沿用本报告的中间哈希。

## 发布包与文档发现

- 现有 `relationship-notes-delivery/3.1.0/relationship-notes-3.1.0.zip` 的package版本为3.1.0，package.json与README和工作区对应，但client.js与本轮整改后的工作区不同。这是后续业务整改造成的预期差异，**不是原3.1.0发布缺陷证据**。父集成任务会冻结源码后构建、重打3.1.1并更新SHA256；旧zip不代表整改版本。
- 安装zip没有build.mjs和verify-v3.mjs，属于运行包而非源码包。已在README补全ZIP安装与源码构建区别、解压加载、升级备份与宿主服务重载步骤。
- 已在 `docs/HOST-API.md` 总表补入 `/interpretation`，保留其详细字段与错误状态章节。
- package.files使用 `src/**/*.js` 能覆盖宿主新增shared模块；根服务入口应持续列入清单。测试为mjs不会被此glob直接包含。公开源码与安装包需分别扫描，不以源码Git忽略规则替代安装包清单。
- pnpm-lock.yaml使用lockfile v9，直接开发依赖specifier与package.json一致：esbuild `^0.28.2`锁定0.28.2、pdfjs-dist精确6.4.299；本机node_modules也匹配这两个版本。README的Node24/pnpm构建说明与当前环境一致。此审查未再次联网安装依赖。
- 宿主index入口的四个服务文件均在package.files中显式列出，其relative imports指向src下analysis、self-profile、shared/text和shared/model-text等纯模块，均由 `src/**/*.js` 覆盖。真实host入口smoke也已执行这些imports，无缺失模块。

## 建议下一轮增加的能力

- 交付包生成脚本：从package.files构造包，生成文件清单/哈希，拒绝个人数据和未构建的旧client，避免手工复制漏文件。
- 备份恢复预检：显示schema版本、联系人/消息/媒体数量及容量，让用户在覆盖前确认范围；错误时保持原库。
- 模型请求诊断：仅记录路由、模型、耗时与错误类别，不写聊天正文；让默认模型失败和格式失败能区分定位。
- DSH真实冒烟记录：导入虚构数据→建立本人档案→生成草稿→开启/撤销共享→处理候选→备份恢复，记录插件版本及宿主版本。

以上为建议，未实现新的采集、监听、主动搭话或发送能力。
