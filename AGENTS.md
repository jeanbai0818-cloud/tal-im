# AGENTS.md — yach-omni-plugin Agent 开发规范

面向 AI Agent（包括 Claude、Codex 等）的开发指南。与 CLAUDE.md 互补，侧重任务执行规范。

---

## 架构速览

```
core/          ← 基建层（Infrastructure）— 冻结，只修 bug
  channel/     — bot plugin 注册、长链接 SDK
  auth/qr/     — QR 扫码登录（获取二维码、轮询、渲染）
  auth/bot/    — AppKey/AppSecret → AccessToken
  session/     — 个人 QR session 持久化（~/.openclaw/identity）
  oapi/        — 知音楼 OAPI HTTP 客户端
  shared/      — 基建层共享类型和常量

personal/      ← 个人身份功能层 — 依赖 QR session
  attendance/  — 考勤打卡、统计
  chat-dm/     — 个人 DM 历史、会话列表
  send-as-self/— 以个人身份发消息

robot/         ← 机器人身份功能层 — 依赖 AppKey/AppSecret
  im/          — 群聊消息收发、自动回复
  contacts/    — 联系人搜索
  docs/        — 文档操作
  okr/         — OKR 管理
  calendar/    — 日程管理
  weekly/      — 周报
  meeting-room/— 会议室预订
  org/         — 组织架构
  mail/        — 邮件发送
  todo/        — 待办

old/           ← 历史存量层 — 只读参考，禁止修改
  old/src/     — 原 src/（守护进程、CLI、共享类型等）
  old/yach/    — 原 yach/（基建实现）
  old/modules/ — 原 modules/（旧业务功能）
```

---

## 执行任务前必读

### 禁止操作
- ❌ 不得修改 `old/` 下任何文件（只读参考）
- ❌ 不得在 `core/` 下添加业务逻辑（基建层只放基础设施代码）
- ❌ 不得修改 `index.ts`、`channel-entry.ts`、`setup-entry.ts` 的 plugin registration 部分
- ❌ 不得引入新的重量级 npm 依赖

### 新功能必须在 `personal/` 或 `robot/` 开发
- 需要个人身份（QR session）→ `personal/[feature]/`
- 需要机器人身份（AppKey/AppSecret）→ `robot/[feature]/`

### 每个功能子目录结构
```
[feature]/
  README.md     ← 功能说明、API 列表
  src/          ← 核心实现
  tools/        ← OpenClaw tool 注册（registerXxxTools）
  skills/       ← AI Agent skill 描述文件（.md）
  scripts/      ← 独立可执行脚本（可选）
```

---

## 新增工具（Tool）标准流程

1. **确认 OAPI 接口**：在 `old/yach/src/oapi/` 找到对应客户端（迁移完成后改为 `core/oapi/`）
2. **确认功能归属**：个人身份 → `personal/`，机器人身份 → `robot/`
3. **创建功能目录**：`[layer]/[feature]/src/` 写逻辑，`[layer]/[feature]/tools/` 写 tool 注册
4. **Tool 注册示例**：

```typescript
// robot/calendar/tools/index.ts
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

export function registerCalendarTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_calendar_create_event',
    description: '在知音楼日历创建日程（需要机器人凭证）',
    parameters: {
      type: 'object',
      properties: {
        title:     { type: 'string', description: '日程标题' },
        startTime: { type: 'string', description: '开始时间 ISO8601' },
        endTime:   { type: 'string', description: '结束时间 ISO8601' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
    async execute(params, ctx) {
      // 过渡期：从 old/ 引入；core/ 迁移完成后改路径
      const { YachClient } = await import('../../../old/yach/src/core/yach-client.js');
      const client = YachClient.fromAccount(ctx.account as never);
      const result = await client.calendar.createEvent(params);
      return { text: JSON.stringify(result, null, 2) };
    },
  });
}
```

5. **在 `old/yach/src/tools/index.ts` 注册**（过渡期）
6. **构建验证**：`npm run build` 无错误

---

## 调用基建层的正确方式（过渡期）

> 在 `core/` 迁移完成之前，从 `old/yach/src/` 引入基建能力。

```typescript
// 获取已鉴权的 YachClient（推荐，机器人身份）
import { YachClient } from '../../../old/yach/src/core/yach-client.js';
const client = YachClient.fromAccount(ctx.account as never);
await client.im.sendMessage({ ... });
await client.calendar.listEvents({ ... });

// 获取账号配置
import { resolveYachAccount } from '../../../old/yach/src/accounts/index.js';
const account = resolveYachAccount({ cfg, accountId });
if (!account.configured) throw new Error('账号未配置');

// 获取 AppToken（机器人身份）
import { getAccessToken } from '../../../old/yach/src/core/app-token.js';
const token = await getAccessToken(account);

// 读取扫码 session（个人身份）
import { readStoredSession } from '../../../old/yach/src/session-store/store.js';
const session = await readStoredSession(stateDir);
```

---

## 凭证存储

| 凭证类型 | 存储位置 | 主要字段 |
|---------|----------|---------|
| 个人 QR session | `~/.openclaw/identity` | `token`, `refreshToken`, `tokenExpiry`, `userId`, `workcode`, `name`, `createdAt` |
| 机器人 AppKey | `openclaw.json → channels.yach.appKey` | — |
| 机器人 AppSecret | `openclaw.json → channels.yach.appSecret` | — |

---

## 常用命令

```bash
npm run build                  # 编译
npm run typecheck              # 类型检查
npm test                       # 测试
npm run plugin:install:link    # 本地构建 + 安装
openclaw gateway restart       # 重启网关
openclaw channels status       # 查看频道状态
```

---

## 代码风格要求

- TypeScript strict 模式
- 不写无意义注释，逻辑自解释
- 错误信息用中文（面向最终用户的提示）
- 工具 `description` 用中文
- 不引入新的重量级依赖
