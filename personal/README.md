# personal/ — 个人身份功能层

**依赖扫码登录（QR session）。** 这里的功能以员工个人身份操作知音楼，凭证来自 `~/.openclaw/identity`。

旧实现参考：[GitLab yach-omni-plugin](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin)

## 子目录

| 目录 | 职责 | 工具数 | 状态 |
|------|------|--------|------|
| `attendance/` | 考勤打卡、环境诊断 | 2 | ✅ 已实现 |
| `chat-dm/` | 个人 DM 历史、会话列表、消息摘要 | — | 🚧 待实现 |
| `docs/` | 文档读取、内容追加（个人身份） | 2 | ✅ 已实现 |
| `mail/` | 邮件发送、收件箱查看、搜索（个人身份） | 3 | ✅ 已实现 |
| `meeting-room/` | 会议室查询、预订、取消（个人身份） | 3 | ✅ 已实现 |
| `okr/` | OKR 列表查询（个人身份） | 1 | ✅ 已实现 |
| `org/` | 通讯录搜索、部门查询、同事查询 | 3 | ✅ 已实现 |
| `send-as-self/` | 以个人身份发送 IM 消息 | — | 🚧 待实现 |
| `weekly/` | 周报列表查询（个人身份） | 1 | ✅ 已实现 |

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

QR 登录：`openclaw channels login`
