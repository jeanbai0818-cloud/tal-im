---
name: yach-tal-im
description: TAL 知音楼（好未来企业 IM）全功能插件。支持数字伙伴机器人（AppKey/AppSecret）和个人扫码登录两种身份，覆盖 IM 消息、日历、文档、OKR、周报、考勤、通讯录、会议室、邮件等企业场景。
version: 2026.5.13
metadata:
  openclaw:
    primaryEnv: YACH_APP_KEY
    requires:
      env:
        - YACH_APP_KEY
        - YACH_APP_SECRET
    envVars:
      - name: YACH_APP_KEY
        required: true
        description: "知音楼开放平台 AppKey — 机器人身份鉴权，所有 robot/ 工具依赖（通过 openclaw config 配置，存储在 openclaw.json channels.yach.appKey）"
      - name: YACH_APP_SECRET
        required: true
        description: "知音楼开放平台 AppSecret — 与 AppKey 配对用于获取 AccessToken（通过 openclaw config 配置，存储在 openclaw.json channels.yach.appSecret）"
      - name: YACH_QR_SESSION
        required: false
        description: "个人 QR 扫码 session — 考勤、邮件、会议室等个人身份工具依赖（通过 openclaw config 扫码登录，存储在 ~/.openclaw/identity/）"
---

# TAL 知音楼插件 (yach-tal-im)

OpenClaw 平台的知音楼（Yach）全功能插件，面向好未来（TAL Education）企业用户。

## 凭证说明

| 凭证 | 对应配置键 | 用途 | 必须 |
|------|-----------|------|------|
| AppKey | `channels.yach.appKey` | 机器人身份鉴权 | ✅ |
| AppSecret | `channels.yach.appSecret` | 获取 AccessToken | ✅ |
| QR 扫码 session | `~/.openclaw/identity/` | 个人身份工具 | 可选 |

凭证均通过 `openclaw config` 向导配置，不需要设置系统环境变量。

## 安全配置

- 默认 `dmPolicy: pairing`（配对模式），陌生用户须通过 `openclaw channels approve` 审批后才能使用
- 破坏性操作（删除文档、发送邮件、移除群成员等）已注册为 `risk: high`，执行前需审批
- 个人 QR session 存储在 `~/.openclaw/identity/`，请确保目录权限为 `700`
