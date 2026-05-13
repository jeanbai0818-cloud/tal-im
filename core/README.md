# core/ — 基建层（Infrastructure）

**冻结层。** 提供频道接入、鉴权、会话持久化、OAPI 客户端等基础能力。一旦稳定，不再修改，只修复 bug。

## 子目录

| 目录 | 职责 |
|------|------|
| `channel/` | openclaw 频道插件注册（bot 长链接）|
| `auth/qr/` | 扫码登录流程（二维码获取、轮询、渲染）|
| `auth/bot/` | 机器人 AppKey/AppSecret → AccessToken |
| `session/` | 个人 QR session 持久化（读写 `~/.openclaw/identity`）|
| `oapi/` | 知音楼 OAPI HTTP 客户端封装 |
| `shared/` | 基建层共享类型和常量 |

## 当前状态

> **开发中。** 代码尚未迁移，旧实现在 `old/yach/src/`。

迁移计划：
- [ ] `core/channel/` ← `old/yach/src/channel/`
- [ ] `core/auth/qr/` ← `old/yach/src/auth-rest/` + `old/yach/src/qr-login/`
- [ ] `core/auth/bot/` ← `old/yach/src/core/app-token.ts`
- [ ] `core/session/` ← `old/yach/src/session-store/`
- [ ] `core/oapi/` ← `old/yach/src/oapi/`
- [ ] `core/shared/` ← `old/src/shared/` + `old/yach/src/accounts/`
