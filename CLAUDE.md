# CLAUDE.md — yach-omni-plugin 开发指南

本文件供 Claude Code 和其他 AI 开发助手读取，描述项目结构、分层规则和开发规范。

---

## 项目简介

**yach-aio** 是 OpenClaw 平台的知音楼（Yach）插件，实现了：
- 数字伙伴机器人接入（AppKey/AppSecret + Channel SDK 长链接）
- 扫码登录（个人身份工具鉴权）
- 消息收发、流式回复
- 各类业务工具（日程、文档、通讯录、IM、OKR、周报等）

---

## 分层架构（最重要的规则）

```
core/          ← 【基建层 Infrastructure】  冻结，只修 bug
personal/      ← 【个人功能层】             依赖 QR session（个人身份）
robot/         ← 【机器人功能层】           依赖 AppKey/AppSecret（机器人身份）
old/           ← 【历史存量层 Legacy】      仅供参考，禁止修改
```

### `core/` — 基建层（冻结）

提供频道接入、鉴权、会话持久化、OAPI 客户端等基础能力。**不要在这里添加业务逻辑。**

| 目录 | 作用 |
|------|------|
| `core/channel/` | OpenClaw channel plugin 注册、长链接 SDK 监听、消息路由 |
| `core/auth/qr/` | QR 登录 REST 客户端、轮询等待、二维码渲染 |
| `core/auth/bot/` | AppKey/AppSecret → AccessToken（机器人鉴权）|
| `core/session/` | 个人 QR session 持久化（读写 `~/.openclaw/identity`）|
| `core/oapi/` | 知音楼 OAPI 原始 HTTP 客户端（IM/日历/文档/组织等）|
| `core/shared/` | 基建层共享类型、常量、账号配置解析 |

> **当前状态**：`core/`（基建层）+ `robot/im/`（消息收发层）已完成新实现，`TAL IM/` 内零 `old/` 引用。`robot/im/` 包含 AES 解密、消息去重、访问控制、Channel SDK 长连接、IM 发送、出站适配器。尚未实现：streaming card（流式消息卡片）、typing indicator、COS 文件上传。`personal/`、`robot/` 其他功能模块待后续迭代。

### `personal/` — 个人身份功能层

凭证来自 `~/.openclaw/identity`（QR 扫码登录后存储）。

| 目录 | 职责 | 迁移来源 |
|------|------|----------|
| `personal/attendance/` | 考勤打卡、月度统计 | `old/src/attendance-bridge/` |
| `personal/chat-dm/` | 个人 DM 历史、会话列表 | `old/src/chat-history/` 等 |
| `personal/send-as-self/` | 以个人身份发送消息 | `old/src/message-send/` |

### `robot/` — 机器人身份功能层

凭证来自 `openclaw.json → channels.yach`（appKey、appSecret）。

| 目录 | 职责 | 迁移来源 |
|------|------|----------|
| `robot/im/` | 群聊消息收发、自动回复、实时监听 | `old/modules/msg/` |
| `robot/contacts/` | 联系人搜索、通讯录同步 | `old/modules/org/` |
| `robot/docs/` | 文档搜索、读写、创建、权限管理 | `old/modules/doc/` |
| `robot/chat-group/` | 群组管理 | `old/src/` 相关部分 |
| `robot/okr/` | OKR 查看、创建、编辑 | `old/modules/okr/` |
| `robot/calendar/` | 日程查询、创建、取消 | `old/modules/schedule/` |
| `robot/weekly/` | 周报草稿/发送/查阅 | `old/modules/weekly/` |
| `robot/meeting-room/` | 会议室搜索、预订、取消 | `old/modules/meeting-room/` |
| `robot/org/` | 组织架构浏览、部门查询 | `old/modules/org/` |
| `robot/mail/` | 邮件发送 | `old/modules/mail/` |
| `robot/todo/` | 待办事项管理 | `old/modules/todo/` |

### `old/` — 历史存量层（只读参考）

旧代码归档，供迁移时参考实现细节。**不要修改，不要在 `old/` 里新增功能。**

```
old/src/       ← 原 src/（守护进程、CLI、历史服务等）
old/yach/      ← 原 yach/（基建实现，正逐步迁往 core/）
old/modules/   ← 原 modules/（业务功能，正逐步迁往 personal/ 或 robot/）
```

---

## 新功能开发流程

### 1. 判断放在哪一层

- 需要 QR 个人身份 → `personal/[feature-name]/`
- 需要机器人身份 → `robot/[feature-name]/`

### 2. 建目录结构

```
[layer]/[feature-name]/
  README.md      ← 功能说明、API 接口列表
  src/           ← 核心实现（OAPI 调用、业务逻辑）
    client.ts    ← 封装 core/oapi/ 的业务客户端
    service.ts   ← 业务逻辑（复杂功能才需要）
  tools/         ← OpenClaw tool 注册
    index.ts     ← registerXxxTools(api)
  skills/        ← AI Agent skill 描述文件（.md）
  scripts/       ← 独立可执行脚本（可选）
```

### 3. 写工具注册（`tools/index.ts`）

```typescript
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

export function registerMyFeatureTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_my_feature_action',
    description: '功能说明（中文，供 AI 理解）',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: '参数说明' },
      },
      required: ['param1'],
    },
    async execute(params, ctx) {
      // TODO: 迁移完成后从 core/ 引入；过渡期从 old/yach/src/core/ 引入
      const { YachClient } = await import('../../old/yach/src/core/yach-client.js');
      const client = YachClient.fromAccount(ctx.account as never);
      const result = await client.xxx.someMethod(params);
      return { text: JSON.stringify(result, null, 2) };
    },
  });
}
```

### 4. 在 `old/yach/src/tools/index.ts` 注册（过渡期）

---

## import 路径规范

> **过渡期**：`core/` 尚未完成，暂时从 `old/yach/src/` 和 `old/src/` 导入基建能力。

| 从哪里导入 | 路径写法 |
|-----------|---------|
| YachIdentity 类型 | `core/shared/types.js` |
| 常量（URL、签名密钥等）| `core/shared/constants.js` |
| 账号配置解析 | `core/shared/account.js` |
| QR session 读写 | `core/session/identity.js` |
| 机器人 AppToken | `core/auth/bot/token.js` |
| QR 登录 | `core/auth/qr/client.js` + `core/auth/qr/poller.js` |
| IM 消息发送（机器人） | `robot/im/oapi.js` → `sendImMessage(...)` |

---

## 凭证存储

| 凭证 | 存储位置 | 字段 |
|------|----------|------|
| 个人 QR session | `~/.openclaw/identity` | `token`, `refreshToken`, `tokenExpiry`, `userId`, `workcode`, `name`, `createdAt` |
| 机器人 AppKey | `openclaw.json → channels.yach.appKey` | — |
| 机器人 AppSecret | `openclaw.json → channels.yach.appSecret` | — |

---

## 常用命令

```bash
npm run build               # TypeScript 编译
npm run typecheck           # 类型检查（不输出文件）
npm test                    # 运行测试
npm run pack:artifact       # 打包 .tgz
npm run plugin:install:link # 本地构建 + 安装到 openclaw
openclaw gateway restart    # 重启网关使插件生效
openclaw channels status    # 查看频道运行状态
```

---

## 关键文件速查

| 文件 | 作用 |
|------|------|
| `index.ts` | OpenClaw 插件入口，注册 channel + CLI（当前导入自 `old/`）|
| `channel-entry.ts` | Channel plugin 入口（兼容保留）|
| `setup-entry.ts` | `openclaw config` 配置向导入口 |
| `old/yach/src/channel/plugin.ts` | Channel plugin 主定义 |
| `old/yach/src/channel/setup-wizard.ts` | 配置向导：QR 扫码 + AppKey/AppSecret |
| `old/yach/src/channel/monitor.ts` | 账号启动入口 |
| `old/yach/src/channel/sdk.ts` | Channel SDK 长链接消息监听 |
| `old/yach/src/messaging/inbound/handler.ts` | 消息处理主逻辑 |
| `old/src/shared/types.ts` | 核心类型定义 |
| `old/src/shared/constants.ts` | 全局常量（DEFAULT_PLUGIN_CONFIG 等）|

---

## 禁止操作

- ❌ 不得在 `old/` 下新增功能或修改业务逻辑
- ❌ 不得在 `core/` 下添加业务逻辑
- ❌ 不得直接修改 `index.ts`、`channel-entry.ts`、`setup-entry.ts` 的 plugin registration 部分
- ❌ 不得引入新的重量级依赖（先检查 `old/yach/src/oapi/` 是否已有封装）
