# robot/ — 机器人身份功能层

**依赖机器人凭证（AppKey/AppSecret）。** 这里的功能以数字伙伴机器人身份操作知音楼，凭证来自 `openclaw.json → channels.yach`。

旧实现参考：[GitLab yach-omni-plugin](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin)

## 子目录

| 目录 | 职责 | 工具数 | 状态 |
|------|------|--------|------|
| `calendar/` | 日程查询、创建、取消、详情 | 4 | ✅ 已实现 |
| `chat-group/` | 群组管理（创建、成员增删、查询） | 5 | ✅ 已实现 |
| `contacts/` | 用户搜索、用户详情 | 2 | ✅ 已实现 |
| `docs/` | 文档读写、创建、删除、协作者管理 | 6 | ✅ 已实现 |
| `im/` | 消息发送/撤回、历史记录、群信息 | 4 | ✅ 已实现 |
| `mail/` | 邮件发送（机器人身份） | — | 🚧 待实现 |
| `meeting-room/` | 会议室查询、预订、取消（机器人身份） | — | 🚧 待实现 |
| `okr/` | OKR 列表查询（机器人身份，可查任意人） | 1 | ✅ 已实现 |
| `org/` | 组织架构浏览、部门查询 | — | 🚧 待实现 |
| `todo/` | 待办事项管理 | — | 🚧 待实现 |
| `weekly/` | 周报列表查询（机器人身份，可查任意人） | 1 | ✅ 已实现 |

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
