# OpenClaw Channel Plugin Development Guide

基于官方文档整理 + 本项目 (yach-tal-im) 踩坑经验。

---

## 1. 什么是 Channel Plugin

Channel Plugin 是让 OpenClaw gateway 接入外部 IM/消息平台的插件类型。它有两套入口：

| 入口 | 文件 | 作用 |
|------|------|------|
| **主入口** (`extensions[]`) | `index.ts` → `dist/index.js` | 注册 channel 到 gateway，启动监听 |
| **配置入口** (`setupEntry`) | `setup-entry.ts` → `dist/setup-entry.js` | `openclaw config` 选择频道后进入的向导 |

两套入口独立加载，必须同时正确。

---

## 2. 目录结构

```
my-channel-plugin/
  index.ts              ← 主入口（defineChannelPluginEntry）
  setup-entry.ts        ← 配置向导入口（defineSetupPluginEntry）
  package.json          ← 含 "openclaw" 节
  openclaw.plugin.json  ← 插件清单
  tsconfig.build.json
  core/
    channel/
      plugin.ts         ← createChatChannelPlugin / createChannelPluginBase
      setup-wizard.ts   ← defineSetupWizard
      monitor.ts        ← 账号启动入口（startAccount）
      sdk.ts            ← 长连接 SDK 封装
  robot/
    im/
      handler.ts        ← 消息处理
      oapi.ts           ← IM 发送 API
```

---

## 3. package.json — "openclaw" 节（完整版）

```json
{
  "name": "my-channel-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "exports": "./dist/index.js",
  "openclaw": {
    "extensions": ["./dist/index.js"],
    "setupEntry": "./dist/setup-entry.js",
    "channel": {
      "id": "my-channel",
      "label": "My Channel（显示名称）",
      "selectionLabel": "My Channel（选择列表显示）",
      "blurb": "频道一句话描述，显示在 openclaw config 选择列表里（必填！）",
      "docsPath": "/channels/my-channel",
      "order": 80
    },
    "install": {
      "npmSpec": "my-channel",
      "localPath": ".",
      "defaultChoice": "local"
    }
  }
}
```

**关键字段说明：**

| 字段 | 是否必填 | 说明 |
|------|----------|------|
| `openclaw.extensions` | 必填 | 主入口 JS 文件路径数组 |
| `openclaw.setupEntry` | **必填** | 配置向导 JS 入口路径；缺少此字段则 `openclaw config` 进不了向导 |
| `openclaw.channel.id` | 必填 | 必须与 `openclaw.plugin.json` `id`、JS export `id` 完全一致 |
| `openclaw.channel.blurb` | **必填** | `openclaw config` 频道列表中冒号后面的说明文字；缺少则显示空白 |
| `openclaw.channel.label` | 必填 | 频道运行状态显示名 |
| `openclaw.channel.selectionLabel` | 必填 | `openclaw config` 选择列表中的条目名 |
| `openclaw.install.npmSpec` | 必填 | npm 包名（用于 `openclaw plugins install <spec>`）|

---

## 4. openclaw.plugin.json — 插件清单

```json
{
  "id": "my-channel",
  "channels": ["my-channel"],
  "setupEntry": "./dist/setup-entry.js",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  },
  "channelConfigs": {
    "my-channel": {
      "label": "My Channel",
      "description": "频道说明",
      "schema": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "enabled":    { "type": "boolean" },
          "name":       { "type": "string" },
          "appKey":     { "type": "string" },
          "appSecret":  { "type": "string" },
          "accounts": {
            "type": "object",
            "additionalProperties": {
              "type": "object",
              "properties": {
                "enabled":   { "type": "boolean" },
                "appKey":    { "type": "string" },
                "appSecret": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

`setupEntry` 在这里也要声明，与 `package.json` 保持一致。

---

## 5. 主入口 index.ts — defineChannelPluginEntry

```typescript
import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { myChannelPlugin } from './core/channel/plugin.js';
import { setMyRuntime } from './core/channel/runtime.js';

export default defineChannelPluginEntry({
  plugin: myChannelPlugin,
  register(api) {
    setMyRuntime(api.runtime as never);
    // 注册 CLI 命令、工具等
  },
});
```

**不要**用裸 `OpenClawPluginDefinition` 对象（旧模式）。`defineChannelPluginEntry` 会自动处理 channel 注册。

---

## 6. 配置向导入口 setup-entry.ts — defineSetupPluginEntry

```typescript
import { defineSetupPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { myChannelPlugin } from './core/channel/plugin.js';

export default defineSetupPluginEntry(myChannelPlugin);
```

**注意：**
- 从 `openclaw/plugin-sdk/channel-core` 导入，**不是** `channel-entry-contract`
- `defineBundledChannelSetupEntry`（来自 `channel-entry-contract`）是给需要懒加载的打包插件用的，普通插件不用
- `defineSetupPluginEntry` 接收 plugin 对象，直接暴露给 openclaw config 向导

---

## 7. Channel Plugin 定义 — createChatChannelPlugin

```typescript
import { createChatChannelPlugin } from 'openclaw/plugin-sdk/channel-core';
import { mySetupWizard } from './setup-wizard.js';
import { startAccount } from './monitor.js';

export const myChannelPlugin = createChatChannelPlugin({
  meta: {
    id: 'my-channel',
    label: 'My Channel',
    selectionLabel: 'My Channel（选择时显示）',
  },
  setupWizard: mySetupWizard,
  async startAccount(account, runtime) {
    return startAccount(account, runtime);
  },
});
```

如果不是 chat 类型，用 `createChannelPluginBase`：

```typescript
import { createChannelPluginBase } from 'openclaw/plugin-sdk/channel-core';

export const myChannelPlugin = createChannelPluginBase({
  meta: { id: 'my-channel', label: 'My Channel', selectionLabel: '...' },
  setupWizard: mySetupWizard,
  async startAccount(account, runtime) { ... },
});
```

---

## 8. Setup Wizard — defineSetupWizard

```typescript
import { defineSetupWizard } from 'openclaw/plugin-sdk/channel-core';

export const mySetupWizard = defineSetupWizard({
  status: {
    async get(account) {
      // 返回当前配置状态，供 openclaw config 显示
      if (!account.config.appKey) {
        return { configured: false, summary: '未配置' };
      }
      return { configured: true, summary: account.config.name ?? account.id };
    },
  },
  credentials: {
    async prepare(account, io) {
      // 在这里做 QR 登录、Token 刷新等准备工作
      // io.print(text) 向用户输出
      // io.prompt(label) 向用户提示输入
    },
    fields: [
      { key: 'appKey',    label: 'App Key',    type: 'text' },
      { key: 'appSecret', label: 'App Secret', type: 'password' },
    ],
    completionNote: '配置完成后请运行 openclaw gateway restart 重启网关。',
  },
});
```

`setupWizard` 必须同时有 `status` 和 `credentials` 两个 key，否则 openclaw 不认为它是声明式向导，会显示"does not support guided setup yet"。

---

## 9. 插件 ID 三元一致（最重要规则）

以下三处必须完全相同：

```
openclaw.plugin.json   "id": "my-channel"
package.json           "openclaw.channel.id": "my-channel"
core/channel/plugin.ts  meta.id: 'my-channel'
```

任何一处不一致，都会导致：
- channel 无法被 gateway 识别
- `openclaw config` 选择后进不了向导（跳到 install 流程或报错）
- `setupEntry` 加载时找不到对应 plugin

---

## 10. openclaw config 工作流（调试用）

```
openclaw config
  ↓
列出所有 channel（读 package.json openclaw.channel.selectionLabel + blurb）
  ↓
用户选择 "my-channel"
  ↓
openclaw 查找 setupEntry（先查 package.json openclaw.setupEntry，再查 openclaw.plugin.json setupEntry）
  ↓
加载 dist/setup-entry.js → 调用 defineSetupPluginEntry 返回的 plugin
  ↓
执行 setupWizard.status.get()  →  显示当前状态
  ↓
执行 setupWizard.credentials.prepare()  →  QR 登录等
  ↓
提示输入 credentials.fields  →  写入 openclaw.json
```

如果在某一步失败，常见原因：

| 现象 | 原因 |
|------|------|
| `blurb` 后面空白 | `package.json openclaw.channel.blurb` 未填 |
| "does not support guided setup yet" | `setupWizard` 缺 `status` 或 `credentials` key |
| "plugin not available" | `setupEntry` 文件路径错误，或 plugin id 不一致 |
| 选完直接跳到 npm install 流程 | `openclaw.plugin.json channels[]` 未包含该 channel id |
| 向导进去后立刻退出 | `setup-entry.ts` 用了错误的包装函数（如 `defineBundledChannelSetupEntry`）|

---

## 11. 构建与安装

```bash
npm run build                                # tsc → dist/
openclaw plugins install . --force          # 安装到本机
openclaw gateway restart                    # 重启使插件生效
openclaw channels status                    # 验证 channel 是否在线
openclaw plugins inspect my-channel --runtime --json  # 查看注册状态
```

---

## 12. 本项目（yach）当前已知问题

1. `setup-entry.ts` 用了 `defineBundledChannelSetupEntry`（来自 `channel-entry-contract`），应改为 `defineSetupPluginEntry`（来自 `channel-core`）
2. `package.json` 的 `"openclaw"` 节缺少 `"setupEntry": "./dist/setup-entry.js"` 字段
3. `package.json` 的 `"openclaw.channel"` 节缺少 `"blurb"` 字段（导致 config 列表中描述为空）
4. `index.ts` 用了旧的裸 `OpenClawPluginDefinition` 对象，应改用 `defineChannelPluginEntry`

---

## 13. 导入路径速查

| 功能 | 导入路径 |
|------|---------|
| `defineChannelPluginEntry` | `openclaw/plugin-sdk/channel-core` |
| `defineSetupPluginEntry` | `openclaw/plugin-sdk/channel-core` |
| `createChatChannelPlugin` | `openclaw/plugin-sdk/channel-core` |
| `createChannelPluginBase` | `openclaw/plugin-sdk/channel-core` |
| `defineSetupWizard` | `openclaw/plugin-sdk/channel-core` |
| `defineBundledChannelSetupEntry` | `openclaw/plugin-sdk/channel-entry-contract`（打包懒加载用）|
| `OpenClawPluginDefinition` 类型 | `openclaw/plugin-sdk/plugin-entry`（旧式插件用）|
