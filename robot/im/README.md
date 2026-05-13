# im/ — 消息收发（机器人身份）

## 功能说明

以机器人身份收发知音楼 IM 消息：发送单聊/群聊消息（文本/Markdown）、撤回消息、查询群历史消息、查询群信息。

同时负责 Channel SDK 长连接监听（接收来自知音楼的 @ 消息并触发 AI Agent 处理）。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_im_send` | 发送消息（单聊或群聊），支持文本/Markdown，支持 @人 |
| `yach_im_recall` | 撤回消息（需消息 ID） |
| `yach_im_history` | 查询群聊历史消息记录（按时间范围分页） |
| `yach_im_group_info` | 查询群聊基本信息（群名、群主、成员列表） |

## 参数说明

### `yach_im_send`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `conv_type` | `'1'` \| `'2'` | 是 | 会话类型（1=单聊，2=群聊） |
| `content` | string | 是 | 消息正文 |
| `to_id` | string | 否 | 接收者用户 ID（单聊）或群 ID（群聊） |
| `to_work_code` | string | 否 | 按工号发送（单聊，与 to_id 二选一） |
| `msgtype` | `'text'` \| `'markdown'` | 否 | 消息类型，默认 `text` |
| `title` | string | 条件必填 | Markdown 标题（msgtype=markdown 时必填） |
| `at_all` | boolean | 否 | 群聊 @所有人 |
| `at_work_codes` | string[] | 否 | 群聊 @指定工号列表 |

### `yach_im_recall`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `yach_mid` | string | 是 | 消息 ID（来自 send 返回值） |

### `yach_im_history`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `group_id` | string | 是 | 群 ID |
| `start_time` | string | 是 | 开始时间，ISO 8601，如 `"2026-05-13T09:00:00+08:00"` |
| `end_time` | string | 是 | 结束时间，ISO 8601 |
| `page_size` | number | 否 | 每页条数，默认 50，最大 50 |
| `page_token` | string | 否 | 分页令牌 |

### `yach_im_group_info`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `group_id` | string | 是 | 群 ID |

## 测试方法

```bash
# 向指定工号发单聊消息
openclaw agent --agent main --message "向工号 A001234 发一条消息：'你好，明天的会议改到3点'" 2>&1

# 向群发消息
openclaw agent --agent main --message "向群 xxx 发送消息：'大家好，今天下午有全员会'" 2>&1

# 向群发 Markdown 消息并 @所有人
openclaw agent --agent main --message "向群 xxx 发送 Markdown 消息，标题'通知'，内容'...'，@所有人" 2>&1

# 查询群今天的消息记录
openclaw agent --agent main --message "查询群 xxx 今天的聊天记录" 2>&1

# 查询群信息
openclaw agent --agent main --message "查一下群 xxx 的基本信息和成员列表" 2>&1
```

## 实现状态

✅ 已实现（含 AES 解密、消息去重、访问控制、Channel SDK 长连接）

尚未实现：streaming card（流式消息卡片）、typing indicator、COS 文件上传

旧实现参考：[GitLab `modules/msg/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/msg)
