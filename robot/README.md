# robot/ — 机器人身份功能层

**依赖机器人凭证（AppKey/AppSecret）。** 这里的功能以数字伙伴机器人身份操作知音楼，凭证来自 `openclaw.json → channels.yach`。

## 子目录

| 目录 | 职责 | 迁移来源 |
|------|------|----------|
| `im/` | 群聊消息收发、自动回复、实时监听 | `old/modules/msg/` |
| `contacts/` | 联系人搜索、通讯录同步 | `old/modules/org/` 联系人部分 |
| `docs/` | 文档搜索、读写、创建、权限管理 | `old/modules/doc/` |
| `chat-group/` | 群组管理 | `old/src/` 相关部分 |
| `okr/` | OKR 查看、创建、编辑 | `old/modules/okr/` |
| `calendar/` | 日程查询、创建、取消 | `old/modules/schedule/` |
| `weekly/` | 周报草稿/发送/查阅 | `old/modules/weekly/` |
| `meeting-room/` | 会议室搜索、预订、取消 | `old/modules/meeting-room/` |
| `org/` | 组织架构浏览、部门查询 | `old/modules/org/` |
| `mail/` | 邮件发送（附件、抄送）| `old/modules/mail/` |
| `todo/` | 待办事项管理 | `old/modules/todo/` |

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

机器人凭证存储于 `openclaw.json → channels.yach`：`appKey`, `appSecret`, `baseUrl`

## 当前状态

> **开发中。** 代码尚未迁移，旧实现在 `old/modules/` 对应目录。
