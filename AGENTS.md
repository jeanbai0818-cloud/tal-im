# AGENTS.md — yach-omni-plugin Agent 开发规范

面向 AI Agent（包括 Claude、Codex 等）的开发指南。与 CLAUDE.md 互补，侧重任务执行规范。

---

## 参考源代码（重要）

遇到任何 API 行为不确定、实现细节不明、或 bug 排查困难时，**先去旧代码看实现**，不要猜测：

> **旧版插件 GitLab 仓库：**
> `https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin`

关键目录映射（旧 → 新）：

| 旧路径 | 新路径 | 说明 |
|--------|--------|------|
| `src/auth-rest/normalize.ts` | `core/auth/qr/client.ts` | QR 轮询、状态解析、身份提取 |
| `src/qr-login/poll.ts` | `core/auth/qr/poller.ts` | 轮询循环逻辑 |
| `src/auth-rest/signature.ts` | `core/shared/crypto.ts` | 请求签名、gtoken 计算 |
| `src/shared/types.ts` | `core/shared/types.ts` | 核心类型定义 |
| `src/shared/constants.ts` | `core/shared/constants.ts` | 常量（API base URL 等）|
| `modules/*/` | `robot/*/` | 机器人身份业务功能 |

> 使用 `git clone --depth=1 https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin /tmp/yach-omni-plugin` 获取只读副本（不要污染工作区）。

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
```

---

## 执行任务前必读

### 禁止操作
- ❌ 不得在 `core/` 下添加业务逻辑（基建层只放基础设施代码）
- ❌ 不得修改 `index.ts`、`channel-entry.ts`、`setup-entry.ts` 的 plugin registration 部分
- ❌ 不得引入新的重量级 npm 依赖
- ❌ 不得将旧代码 clone 到工作区目录（克隆到 `/tmp/` 看完即扔）

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

1. **确认 OAPI 接口**：先查旧仓库 `src/oapi/`（见上方 GitLab 参考源），再在 `core/oapi/` 实现
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
      // 调用 core/oapi/ 封装的客户端
      const { getAccessToken } = await import('../../../core/auth/bot/token.js');
      const account = ctx.account as import('../../../core/shared/types.js').ResolvedYachAccount;
      const token = await getAccessToken(account);
      // ... 调用 core/oapi/ 方法
      return { text: JSON.stringify(params, null, 2) };
    },
  });
}
```

5. **在 `channel-entry.ts` 的 `registerFull` 里调用** `register[Feature]Tools(api)`
6. **构建验证**：`npm run build` 无错误

---

## 调用基建层的正确方式

```typescript
// 获取 AppToken（机器人身份）
import { getAccessToken } from '../../../core/auth/bot/token.js';
const token = await getAccessToken(account);

// 读取 QR session（个人身份）
import { loadIdentity } from '../../../core/session/identity.js';
const identity = await loadIdentity();
if (!identity) throw new Error('未找到扫码登录凭证，请先运行 openclaw config 完成扫码');

// IM 消息发送（机器人）
import { sendImMessage } from '../../../robot/im/oapi.js';
await sendImMessage({ account, conversationId, content });
```

> 如需查阅 OAPI 封装细节，参考旧仓库 `src/oapi/` 和 `src/auth-rest/`。

---

## 凭证存储

| 凭证类型 | 存储位置 | 主要字段 |
|---------|----------|---------|
| 个人 QR session | `~/.openclaw/identity` | `token`, `refreshToken`, `tokenExpiry`, `userId`, `workcode`, `name`, `createdAt` |
| 机器人 AppKey | `openclaw.json → channels.yach.appKey` | — |
| 机器人 AppSecret | `openclaw.json → channels.yach.appSecret` | — |

---

## 开发测试网关（gateway-TAL-IM）

> **为什么要用独立网关**：将 `yach-tal-im` 的开发测试与生产 openclaw 环境完全隔离，避免污染已有 agent、频道、插件配置。

### 目录结构

```
~/Desktop/gateway-TAL-IM/
  state/     ← 独立 openclaw 状态目录（openclaw.json、extensions、agents 等）
```

### 一次性初始化

```bash
# 1. 安装插件到 dev 状态目录
OPENCLAW_STATE_DIR=~/Desktop/gateway-TAL-IM/state npm run deploy

# 2. 配置频道凭证（AppKey/AppSecret + 扫码登录）
OPENCLAW_STATE_DIR=~/Desktop/gateway-TAL-IM/state openclaw config
```

### 启动开发网关（前台运行，按 Ctrl+C 停止）

```bash
OPENCLAW_STATE_DIR=~/Desktop/gateway-TAL-IM/state \
  openclaw gateway --port 19002 --auth none
```

### 每次代码更新后重新部署

```bash
# 重新构建 + 安装到 dev 状态目录，然后重启网关
OPENCLAW_STATE_DIR=~/Desktop/gateway-TAL-IM/state npm run deploy
# 之后重启上面的 gateway 进程（Ctrl+C 再启动）
```

### 测试命令（指向 dev 网关）

```bash
# 查看频道状态
OPENCLAW_STATE_DIR=~/Desktop/gateway-TAL-IM/state openclaw channels status

# 发送 agent 消息
OPENCLAW_STATE_DIR=~/Desktop/gateway-TAL-IM/state \
  openclaw agent --agent <agentId> --message "帮我打一个下班卡"

# gateway call 测试
openclaw gateway call \
  --url ws://127.0.0.1:19002 \
  --auth none \
  --expect-final --json --timeout 60000 \
  agent --params '{"agentId":"<id>","message":"<消息>","idempotencyKey":"test-1"}'
```

> **注意**：不要省略 `OPENCLAW_STATE_DIR`，否则命令默认操作 `~/.openclaw/`（生产环境）。

---

## 常用命令

```bash
npm run build               # 编译
npm run typecheck           # 类型检查
npm run deploy              # 编译 + 安装到生产 ~/.openclaw/
openclaw gateway restart    # 重启生产网关
openclaw channels status    # 查看生产频道状态
```

---

## 代码风格要求

- TypeScript strict 模式
- 不写无意义注释，逻辑自解释
- 错误信息用中文（面向最终用户的提示）
- 工具 `description` 用中文
- 不引入新的重量级依赖
