# 消息身份、来源上下文与资料有效期

每条消息新增持久 `messageId`。导入、排序和恢复使用同一纯模块 `src/message-identity.js`：保留已有有效唯一 ID；旧记录按发送者、时间、原文、来源文件/类型和原生 ID 的组合生成指纹，再以同组出现次数区分同文记录。原生 `id` 保留不改写，旧画像指纹保存在 `legacyMessageIds`，以便兼容旧引用。消息编辑应保留 `messageId`，不得重新用数组下标作为永久身份。

`ensureMessageIds(messages)` 不改变原数组。`ensureContactMessageIds(contact)` 为消息赋 ID，并把能够唯一核对的旧事实来源迁移至新 ID。`sortChatMessages` 会先为缺 ID 的旧记录赋 ID，再排序，因此排序后身份不变。全量同文件重导入按现有出现次数去重；原生 ID 不同的同文记录会保留。

`resolveEvidenceContext(contact, ref, {radius:3})` 支持 messageId、sourceMessageIds、旧字符串 ID、factId、来源 message 或 quote。返回 `found`、`ambiguous` 或 `missing`；找到后返回消息、当前索引和有界前后文。数组 messageIndex 仅是旧提示，不单独作为依据；多个同文来源不自动选第一条。

没有原生唯一 ID、时间和正文也完全相同的两个独立事件，本身没有足够信息区分。持久化后的出现次数 ID 能稳定标识当前记录，但来自不完整增量文件的单个同文事件无法可靠判断是重放还是新发言。当前采用保守去重，不声称可凭文本彻底解决该歧义。不同来源文件也不会擅自合并成同一事件。

资料生命周期增加完成、取消、过期、重新打开及设置到期日。`profileFactStatus(fact, now)` 返回有效状态；`isProfileFactCurrent(fact, now)` 用于建议、回复与 DSH 共享的过滤。`profileExpiryTime` 规定日期形式 `YYYY-MM-DD` 在上海当天结束后过期，非法日期返回 NaN，设置接口会明确报错。重新打开会清除到期日和结束状态，状态变更保留 `lifecycleHistory`。

`changeProfile` 新动作：`complete` / `cancel` 适用于待跟进、近况、约定和计划；`expire` 可用于全部资料；`reopen` 恢复完成/取消/过期记录；`setExpiry` 接收 `{uid, expiresAt}`。到期可以动态生效，不需要后台进程修改数据。
