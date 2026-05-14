# weekly/ — 周报查询（个人身份）

## 功能说明

以当前扫码登录用户身份查询知音楼周报列表。支持按人员、部门或伙伴分组筛选，支持日期范围、未读过滤和分页。

> 另见 `robot/weekly/` — 机器人身份版本，可以查询任意人员/部门（无需本人登录）。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_personal_weekly_list` | 查询周报列表，支持多维度筛选和分页 |

## 参数说明

### `yach_personal_weekly_list`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query_type` | `'person'` \| `'department'` \| `'team_id'` \| `'team_name'` | 否 | 筛选类型 |
| `query_value` | string | 条件必填 | 筛选值（`query_type` 存在时必填） |
| `start_date` | string | 否 | 开始日期，格式 `YYYY-MM-DD` |
| `end_date` | string | 否 | 结束日期，格式 `YYYY-MM-DD` |
| `unread` | boolean | 否 | 是否只返回未读周报，默认 `false` |
| `sort` | `'asc'` \| `'desc'` | 否 | 排序方式，默认 `desc` |
| `next_page` | string | 否 | 分页令牌（来自上一次返回） |

## 测试方法

```bash
# 查询本周周报
openclaw agent --agent main --message "帮我查一下本周的周报" 2>&1

# 查询指定人员的周报
openclaw agent --agent main --message "查一下工号 A001234 上周提交的周报" 2>&1

# 查询未读周报
openclaw agent --agent main --message "我有哪些未读周报？" 2>&1

# 查询某部门本月周报
openclaw agent --agent main --message "查一下产品部2026年5月份的周报列表" 2>&1
```

## 实现状态

✅ 已实现

