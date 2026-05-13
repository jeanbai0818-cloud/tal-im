# org/ — 通讯录搜索（个人身份）

## 功能说明

从本地通讯录快照中搜索员工、查询部门成员、查找某人的同事列表。

> **前置条件：** 需先执行 `openclaw yach contacts sync` 同步通讯录到本地快照，否则工具会提示执行同步。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_org_search` | 按姓名、工号或部门关键字搜索员工 |
| `yach_org_dept` | 按部门名称关键字查询部门列表，或按部门 ID 列出直属成员 |
| `yach_org_peers` | 查找某人并列出其同部门同事 |

## 参数说明

### `yach_org_search`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 搜索关键字（姓名、工号或部门名称） |
| `limit` | number | 否 | 返回条数上限，默认 20 |

### `yach_org_dept`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `dept_query` | string | 二选一 | 部门名称关键字 |
| `dept_id` | string | 二选一 | 部门 ID（精确查询直属成员） |

### `yach_org_peers`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 姓名或工号（精确匹配） |
| `limit` | number | 否 | 返回同事条数上限，默认 20 |

## 测试方法

```bash
# 同步通讯录（首次使用前）
openclaw yach contacts sync

# 搜索员工
openclaw agent --agent main --message "在通讯录里搜一下叫张三的同事" 2>&1

# 查询部门成员
openclaw agent --agent main --message "查一下技术部有哪些成员" 2>&1

# 查找某人的同事
openclaw agent --agent main --message "查一下工号 A001234 的同部门同事有哪些" 2>&1
```

## 实现状态

✅ 已实现

旧实现参考：[GitLab `modules/org/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/org)
