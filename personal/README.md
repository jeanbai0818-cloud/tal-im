# personal/ — 个人身份功能层

**依赖扫码登录（QR session）。** 这里的功能以员工个人身份操作知音楼，凭证来自 `~/.openclaw/identity`。

## 子目录

| 目录 | 职责 | 迁移来源 |
|------|------|----------|
| `attendance/` | 考勤打卡、月度/半年统计 | `old/src/attendance-bridge/` |
| `chat-dm/` | 个人 DM 历史、会话列表、消息摘要 | `old/src/chat-history/` 等 |
| `send-as-self/` | 以个人身份发送消息 | `old/src/message-send/` |

## 功能目录结构

每个功能子目录：

```
[feature]/
  src/         ← 业务逻辑，调用 core/oapi/
  tools/       ← registerXxxTools(api) — OpenClaw tool 注册
  skills/      ← .md skill 描述文件（供 AI Agent 调用说明）
  scripts/     ← 独立可执行脚本（可选，复杂工作流）
```

## 凭证

个人 QR session 存储于 `~/.openclaw/identity`。

字段：`token`, `refreshToken`, `tokenExpiry`, `userId`, `workcode`, `name`, `createdAt`

## 当前状态

> **开发中。** 代码尚未迁移，旧实现在 `old/src/` 对应目录。
