# mail/ — 邮件（机器人身份）

## 功能说明

以机器人身份在知音楼发送邮件。

> 另见 `personal/mail/` — 个人身份版本，功能更全（含收件箱查看和搜索）。

## 工具列表

> 🚧 **待实现** — tools/ 目录尚为空，工具注册尚未完成。

计划工具：

| 工具名（规划中） | 说明 |
|-----------------|------|
| `yach_robot_mail_send` | 以机器人身份发送邮件 |

## 测试方法

> 待工具实现后补充。

```bash
# 示例（功能上线后）
openclaw agent --agent main --message "以机器人身份给 test@example.com 发邮件，主题'自动通知'，内容'系统检测到异常，请关注'" 2>&1
```

## 实现状态

🚧 待实现 — `src/` 和 `tools/` 均为空占位

旧实现参考：[GitLab `modules/mail/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/mail)
