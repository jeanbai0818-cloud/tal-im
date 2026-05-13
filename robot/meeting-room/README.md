# meeting-room/ — 会议室（机器人身份）

## 功能说明

以机器人身份查询可用会议室、预订和取消会议室。

> 另见 `personal/meeting-room/` — 个人身份版本，已实现。

## 工具列表

> 🚧 **待实现** — tools/ 目录尚为空，工具注册尚未完成。

计划工具：

| 工具名（规划中） | 说明 |
|-----------------|------|
| `yach_robot_meeting_search_rooms` | 查询指定时段可用会议室 |
| `yach_robot_meeting_book` | 预订会议室 |
| `yach_robot_meeting_cancel` | 取消会议室预订 |

## 测试方法

> 待工具实现后补充。

```bash
# 示例（功能上线后）
openclaw agent --agent main --message "以机器人身份查一下明天下午2点到3点望京有哪些空闲会议室" 2>&1
```

## 实现状态

🚧 待实现 — `src/` 和 `tools/` 均为空占位

旧实现参考：[GitLab `modules/meeting-room/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/meeting-room)
