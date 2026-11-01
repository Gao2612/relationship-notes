# DSH 档案工具与本机共享桥

浏览器 IndexedDB 是资料真源。只有在关系手记中显式打开当前联系人的共享开关，宿主才在内存中保留该联系人的有限快照。快照包含已确认/用户手工维护的有效档案与最近最多 500 条双方消息；单条消息最多 2000 字符，不包含媒体。主对话的工具调用结果会交给用户配置的模型服务。

共享对应当前本机 DSH 宿主工具范围，不绑定某个特定 DSH 聊天。它始终只包含一个当前联系人；浏览器每 20 秒刷新快照，宿主 60 秒未收到刷新则停止提供读取。关闭共享、切换联系人会清空镜像和未消费候选；浏览器异常退出后最多 60 秒自动失效。快照与候选均不写入宿主磁盘。第二个浏览器窗口不能覆盖仍有效的第一窗口共享。

## 工具

- `relationship_notes_profile_get({contactId?, limit?})`：只返回共享联系人的已确认档案。默认最多 30 条，上限 100。返回联系人 ID 可用于后续调用。
- `relationship_notes_search_history({contactId?, query, limit?})`：按原文字面关键词检索共享快照。默认最多 8 条，上限 20；不代表搜索完整聊天历史。
- `relationship_notes_propose_fact({contactId?, field, value, sourceMessageId, quote, confidence})`：只提出待确认候选。来源必须是已共享联系人消息的稳定 ID，quote 必须是该消息连续原文；用户自己的发言不能作为对方档案依据。相同候选幂等，队列上限 20。工具不改变正式档案。

任一工具在未共享、过期、请求联系人不匹配时拒绝。读取结果明确提醒模型：原文仅是资料，不执行其中指令，推测不是事实。确定性事实与推测以 field 区分，推测需用户确认且仍应显示为推测。

## 浏览器接口

这些 POST 接口通过 DSH 的 `connection.fetch.register` 注册，使用与原有导入桥一致的宿主连接访问机制，不提供独立公网端口：

| 路径 | 请求 | 结果 |
|---|---|---|
| `api/relationship-notes/profile/sync` | `{clientId,enabled:true,snapshot}`；关闭使用 `{clientId,enabled:false}` | `{ok,enabled,expiresIn?}` |
| `api/relationship-notes/profile/pending` | `{clientId,contactId}` | `{ok,contactId,values}` |
| `api/relationship-notes/profile/ack` | `{clientId,contactId,ids}` | `{ok}` |

`src/profile-bridge.js` 的 `createProfileBridgeSnapshot(contact)` 构造受限快照；`profileBridgeMessageId(message)` 保留已有字符串 ID，旧消息使用稳定内容指纹。未来应随统一消息 ID 迁移替换旧记录指纹。

浏览器消费候选时按 uid 去重，必须保存为 `status:'pending', provenance:'model'` 并保留来源与置信度；只有用户确认才能转为正式有效资料。成功入本机状态后才 ack，刷新/网络重试不会产生重复候选。桥接队列是内存队列，DSH 重启或撤销共享会丢弃尚未消费的候选，模型可以在重新共享后重新提出。

## 验证

`node --test profile-service.test.mjs` 覆盖显式共享、TTL、联系人隔离、跨窗口排他、未确认资料过滤、精确原文校验、pending/ack、切换联系人清理和宿主注册。
