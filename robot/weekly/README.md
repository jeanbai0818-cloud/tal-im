# weekly/ — 周报查询（机器人身份）

## 功能说明

以机器人身份查询知音楼周报列表。可以查询任意人员、部门或伙伴分组的周报，无需本人登录。

> 另见 `personal/weekly/` — 个人身份版本，受本人权限限制。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_weekly_list` | 查询任意人员或部门的周报列表，支持多维度筛选和分页 |

## 参数说明

### `yach_weekly_list`

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
# 查询指定人员的周报
openclaw agent --agent main --message "查一下工号 A001234 本周提交的周报" 2>&1

# 查询某部门本月周报
openclaw agent --agent main --message "查一下产品部2026年5月份的周报列表" 2>&1

# 查询伙伴分组的周报
openclaw agent --agent main --message "查一下伙伴组'研发小队'上周的周报" 2>&1

# 查询未读周报
openclaw agent --agent main --message "有哪些团队周报还没读？" 2>&1
```

## 实现状态

✅ 已实现

旧实现参考：[GitLab `modules/weekly/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/weekly)
