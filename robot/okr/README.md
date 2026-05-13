# okr/ — OKR 查询（机器人身份）

## 功能说明

以机器人身份查询知音楼 OKR 列表。可以查询任意人员或部门的 OKR，无需该人员本人登录。

> 另见 `personal/okr/` — 个人身份版本，只能查询本人有权限查看的 OKR。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_okr_list` | 查询任意人员或部门的 OKR 列表，支持月份范围和分页 |

## 参数说明

### `yach_okr_list`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query_type` | `'person'` \| `'department'` | 否 | 筛选类型 |
| `query_value` | string | 条件必填 | 筛选值（`query_type` 存在时必填；person 填工号，department 填部门 ID） |
| `start_month` | string | 否 | 开始月份，格式 `YYYY-MM` |
| `end_month` | string | 否 | 结束月份，格式 `YYYY-MM` |
| `sort` | `'asc'` \| `'desc'` | 否 | 排序方式，默认 `desc` |
| `next_page` | string | 否 | 分页令牌（来自上一次返回） |

## 测试方法

```bash
# 查询指定工号人员的 OKR
openclaw agent --agent main --message "查一下工号 A001234 今年5月的 OKR" 2>&1

# 查询某部门的 OKR
openclaw agent --agent main --message "查一下技术部2026年第二季度的 OKR 列表" 2>&1

# 不加筛选（查全部）
openclaw agent --agent main --message "查一下知音楼本月所有 OKR" 2>&1
```

## 实现状态

✅ 已实现

旧实现参考：[GitLab `modules/okr/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/okr)
