# send-as-self/ — 以个人身份发送消息

## 功能说明

以当前扫码登录用户身份发送知音楼 IM 消息（单聊）。消息来源为员工本人，而非机器人。

> 与 `robot/im/` 的区别：robot/im 以机器人身份发送，本模块以个人员工身份发送，适合需要"本人发出"语义的场景。

## 工具列表

> 🚧 **待实现** — tools/ 目录尚为空，工具注册尚未完成。

计划工具：

| 工具名（规划中） | 说明 |
|-----------------|------|
| `yach_send_as_self` | 以个人身份向指定用户发送单聊消息 |

## 测试方法

> 待工具实现后补充。

```bash
# 示例（功能上线后）
openclaw agent --agent main --message "以我的名义给张三发消息：'明天的会议改到下午3点'" 2>&1
```

## 实现状态

🚧 待实现 — `src/` 和 `tools/` 均为空占位

旧实现参考：[GitLab `src/message-send/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/src/message-send)
