# 宿主 API 契约

核对日期：2026-11-01。依据当前 `reply-service.js`、`interpretation-service.js`、`import-service.js` 和 `profile-service.js`。所有路由以 `/api/relationship-notes` 为前缀，接受 POST JSON，成功结果含 `ok:true`，失败含 `ok:false,error:string`。未知字段按各处理器校验拒绝。

## 模型路由

| 路径 | 请求字段 | 成功响应字段（除 ok） |
|---|---|---|
| `/models` | 空对象 `{}` | `providers:[{id,name,modelsError,models:[{id,name}]}]`；提供默认选择器时含 `default:{provider,model}|null`。 |
| `/reply` | `self,target,messages,facts,dailyTimeline,scenario,tone,intent`；可选成对 `provider,model`，以及 `relatedMessages,selfProfile,suggestions,suggestionDisclaimer` | `draft,provider,model`；本地明确边界分支另含 `mode:'local',boundary:true`。 |
| `/timeline-analysis` | `self,target,days` | `days:[{date,summary,activityReason,affinityContext}],provider,model`。 |
| `/profile-analysis` | `target,messages`；可选 `mode:'summary'` | `facts:[{field,value,id,quote}],model`。 |
| `/media-analysis` | `mediaType:'image'|'video',frames` | `analysis,provider,model`。 |
| `/interpretation` | `self,target,messages`；可选成对 `provider,model` 和 `selfProfile` | `interpretations:[{explanation,uncertainty,evidence:[{messageId,quote}],reply}]`；详细限制见文末“可能解释接口”。 |

模型列表与 reply/timeline/profile-analysis 的通用请求体原始字符上限为 64000；interpretation 为 60000。reply 的序列化背景上限为 60000 字符；显式 provider/model 都必须非空，省略则读取 DSH 默认模型。服务商凭据与模型传输留在宿主，不随响应返回。

### 回复载荷

- `messages` 最多20条、`relatedMessages` 最多8条，消息为 `{sender,text,timestamp?}`；sender 必须等于 self 或 target，正文最多1000字符。双方名称最多100字符且必须不同。
- `facts` 最多30项，形状 `{field,value}`，长度分别100/500字符。
- `dailyTimeline` 最多800项，形状 `{date,messages,self,target,turns,activityScore,affinityScore,affinityChange,reason,affinityEvidence}`。日期 `YYYY-MM-DD`，计数0–10000；活跃度0–100，线索分允许null或0–100整数，变化允许null或−100–100整数；reason最多360字符，原文证据最多3条、每条100字符。
- `scenario,tone,intent` 均为不超过500字符的字符串。`selfProfile` 是不超过10000序列化字符的对象，宿主使用 `normalizeSelfProfile` 规范化；`suggestions` 最多5项且整体不超过8000字符，免责声明不超过500字符。

### 日期、画像和媒体批次

- 日期分析每批1–20天，day为 `{date,messageCount,selfMessages,targetMessages,turns,activityScore,affinityScore,affinityChange,transcript}`，transcript最多500条且数量等于messageCount。其消息 `{sender,text}`，单条正文最多300字符。序列化批次不超过60000字符。返回日期必须逐一匹配请求，摘要/原因不能为空且各字段最多800字符。
- 画像分析消息1–1000条，每条 `{id,text}`，id为非负整数，正文最多2000字符；序列化批次最多60000字符。模型返回引用必须是对应消息连续原文。summary最多8项，普通返回验证上限30项；value最多300字符。允许字段见源码的字段白名单，当前含 city/job/interests/preferences/plans/daily/style/boundary/followup/inference；是否正式采纳由客户端确认流决定。
- 媒体请求最多12MiB字符；frames为1–4项 `{data,mimeType,timestamp}`，data是无data URL头的base64。MIME仅jpeg/png/webp，单帧解码最多4MiB、总计8MiB，时间为0–3600秒。模型须支持图片输入，附件经宿主 attachment service 保存后用于调用模型。

## 导入与当前联系人桥接

| 路径 | 请求字段 | 成功响应 |
|---|---|---|
| `/import/read` | 空对象；允许空请求正文 | `{ok:true,values:[导入队列条目]}`。 |
| `/import/ack` | `{versions:string[]}`，非空、不重复、数量不超过队列上限 | `{ok:true,remaining:number}`；只删除匹配版本。 |
| `/profile/sync` | `{clientId,enabled,snapshot?}` | `{ok:true,enabled,expiresIn?}`；关闭共享清理该窗口的内存共享数据。 |
| `/profile/pending` | `{clientId,contactId}` | `{ok:true,contactId,values:[待确认候选]}`。 |
| `/profile/ack` | `{clientId,contactId,ids:string[]}` | `{ok:true}`；清除已处理候选。 |

profile桥接请求最多2000000字符；snapshot为 `{contact:{id,self,target},facts,messages}`，最多100条已确认事实、500条消息，单条消息正文最多2000字符。共享按窗口和当前联系人隔离，有过期时间，候选只留在内存。读取工具 `relationship_notes_profile_get` 与 `relationship_notes_search_history` 使用此快照；`relationship_notes_propose_fact` 只提出带原文的候选，不能直接更新正式档案。详细字段和限额以 `profile-service.js` 的 schema 为准。

## 错误状态

| 状态 | 含义 |
|---|---|
| 400 | JSON、字段、类型、长度、数量或引用校验失败。部分通用背景体积过大也返回400。 |
| 403 | profile桥接中的窗口身份或联系人范围不匹配。 |
| 405 | 非POST请求。路由层也限制POST。 |
| 409 | profile共享未开启/过期、另一窗口正在共享，或候选队列已满。 |
| 413 | 媒体、导入或profile桥接请求超过对应大小限制。 |
| 415 | 当前默认模型不支持图片输入。 |
| 499 | bounded模型请求被取消。 |
| 500 | 导入/profile桥接处理器的未预期内部错误。 |
| 502 | 模型调用失败、未完成、输出过长或返回结构不合要求；模型路由未预期异常也映射为502。 |
| 503 | 没有可用DSH默认模型。 |
| 504 | bounded模型请求超时。媒体路由独立使用AbortSignal，超时异常按其现有通用错误响应处理，不保证504。 |

## 文本过滤边界

宿主 `cleanTimelineText` 已移到 `src/shared/text.js`，其策略为剔除日期分析中的说明性片段。浏览器 `cleanTimelineDisplayText` 的过滤词与空值处理不同，是历史显示兼容策略；没有将二者机械合并，避免改变旧数据展示。以后统一时应先明确产品语义，再同时覆盖宿主与显示样本。
# 可能解释接口

`POST /api/relationship-notes/interpretation` 仅由用户点击触发，不自动分析或发送消息。

请求字段白名单：`provider`、`model`（一并提供或使用DSH默认模型）、`self`、`target`（各最多100字符且不同）、`messages`、可选 `selfProfile`。`messages` 为1–20条 `{id,sender,text}`；id最多200字符且唯一，sender只允许双方，text每条最多2000字符。本人档案最多10000字符并经规范化。整个JSON请求最多60000字符，未知字段拒绝。

成功返回 `{ok:true,interpretations:[{explanation,uncertainty,evidence:[{messageId,quote}],reply}]}`。提供2–3种可能解释；每项至少一条、最多三条引用，引用必须逐字包含于对应输入消息。explanation、uncertainty、reply各最多600字符，quote最多500字符。模型输出最多14000字符，并须有完整结束事件及有效JSON。拒绝伪造引用和确定性好感判断。草稿只供用户编辑、复制。

错误返回 `{ok:false,error}`：400请求结构/长度错误，405方法错误，499用户取消，502模型调用、JSON或引用校验失败，504总调用超时。调用使用60秒总超时竞速及请求取消信号，即使提供商忽略signal也会及时结束HTTP等待。兼容text-delta和完整文本block-end输出。内容仅发送给用户配置的DSH模型服务，不写入联系人正式档案。
