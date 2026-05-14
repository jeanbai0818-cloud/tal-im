# contacts/ — 用户搜索

## 功能说明

以机器人身份搜索知音楼用户，或按 userId / 工号精确查询用户详情。

> 与 `personal/org/` 的区别：personal/org 依赖本地通讯录快照（需先同步），本模块实时查询 OAPI，适合需要精确用户 ID 的场景（如向某人发消息前先查 userId）。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_user_search` | 按关键字（姓名、工号、邮箱等）搜索用户，返回匹配列表 |
| `yach_user_get` | 按 userId 或工号精确查询用户详情（姓名、部门、邮箱等） |

## 参数说明

### `yach_user_search`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 是 | 搜索关键字，至少 2 个字符 |

### `yach_user_get`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | 二选一 | 知音楼用户 ID（`yachXXXXX` 或 17 位纯数字） |
| `workCode` | string | 二选一 | 员工工号 |

## 测试方法

```bash
# 搜索用户
openclaw agent --agent main --message "在知音楼搜索用户张三" 2>&1

# 按工号查询用户详情
openclaw agent --agent main --message "查一下工号 A001234 的用户信息" 2>&1

# 按 userId 查询
openclaw agent --agent main --message "查一下知音楼用户 yach12345 的详细信息" 2>&1
```

## 实现状态

✅ 已实现

