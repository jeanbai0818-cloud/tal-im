# org/ — 组织架构（机器人身份）

## 功能说明

以机器人身份查询知音楼组织架构：浏览部门层级、查询部门成员、搜索员工。

> 另见 `personal/org/` — 个人身份版本（依赖本地通讯录快照），`robot/contacts/` — 实时用户搜索和详情查询。

## 工具列表

> 🚧 **待实现** — tools/ 目录尚为空，工具注册尚未完成。

计划工具：

| 工具名（规划中） | 说明 |
|-----------------|------|
| `yach_robot_org_dept_list` | 列出子部门 |
| `yach_robot_org_dept_members` | 查询部门直属成员 |

## 测试方法

> 待工具实现后补充。

```bash
# 示例（功能上线后）
openclaw agent --agent main --message "查一下知音楼技术部下面有哪些子部门" 2>&1
```

## 实现状态

🚧 待实现 — `src/` 和 `tools/` 均为空占位

旧实现参考：[GitLab `modules/org/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/org)
