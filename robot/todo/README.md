# todo/ — 待办事项

## 功能说明

以机器人身份管理知音楼待办事项：查询、创建、更新、完成待办。

## 工具列表

> 🚧 **待实现** — tools/ 目录尚为空，工具注册尚未完成。

计划工具：

| 工具名（规划中） | 说明 |
|-----------------|------|
| `yach_todo_list` | 查询待办列表 |
| `yach_todo_create` | 创建待办事项 |
| `yach_todo_complete` | 标记待办为已完成 |

## 测试方法

> 待工具实现后补充。

```bash
# 示例（功能上线后）
openclaw agent --agent main --message "帮我创建一个待办：明天下午5点前完成插件联调报告" 2>&1

openclaw agent --agent main --message "查一下我当前有哪些未完成的待办" 2>&1
```

## 实现状态

🚧 待实现 — `src/` 和 `tools/` 均为空占位

旧实现参考：[GitLab `modules/todo/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/todo)
