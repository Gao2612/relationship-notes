# 本机数据 schema 2

浏览器 IndexedDB 的现有 object store 结构保持兼容，记录内容的 `schemaVersion` 升为 2。读取 schema 1 的记录或旧版 `relationship-notes-backup` 备份时，纯迁移函数补齐并规范化本人表达档案；联系人、画像状态、纠正历史和未知扩展字段保留。新备份仍使用 format version 1，并另行标记 `schemaVersion:2`，旧备份可继续恢复。

未来未知 schema 不会强制降级。客户端显示读取失败，并进入禁止覆盖状态；用户可以使用兼容版本，或明确恢复一份兼容备份/清除旧数据。备份恢复不会恢复 DSH 共享授权。

存储配额不足时，fallback 现在正确处理 `{schemaVersion,savedAt,state}` 包装：保存聊天和资料，移除头像/媒体二进制副本并告知用户；不会因错误访问顶层 contacts 而令文本也无法保存。

档案分析仍使用宿主兼容的请求临时数字 ID，但发送时捕获数字 ID 到原文及稳定消息 ID 的 Map。返回结果必须能在当前联系人记录中找到相同原文和时间，且 quote 是连续原文；消息排序不会改变引用，已修改或删除的来源会被丢弃。正式档案保存稳定来源 ID。
