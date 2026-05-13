# calendar/ — 日程管理

## 功能说明

以机器人身份在知音楼创建、查询、取消日程（会议、提醒等）。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_schedule_list` | 查询指定时间段内的日程列表，可按工号筛选 |
| `yach_schedule_create` | 创建日程，返回日程 ID |
| `yach_schedule_cancel` | 取消/删除日程 |
| `yach_schedule_get` | 查询单条日程详细信息 |

## 参数说明

### `yach_schedule_list`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startDate` | string | 是 | 开始时间，ISO 8601，如 `"2026-05-01T00:00:00"` |
| `endDate` | string | 是 | 结束时间，ISO 8601，如 `"2026-05-31T23:59:59"` |
| `workCodes` | string[] | 否 | 按工号筛选，最多 10 个 |
| `includeAll` | boolean | 否 | 是否包含已取消和已拒绝的日程，默认 `false` |

### `yach_schedule_create`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 日程标题 |
| `startTime` | string | 是 | 开始时间，ISO 8601 |
| `endTime` | string | 是 | 结束时间，ISO 8601 |
| `participants` | string | 否 | 参与人知音楼用户 ID，多个用英文逗号分隔 |
| `remark` | string | 否 | 日程备注 |
| `address` | string | 否 | 地点 |

### `yach_schedule_cancel`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scheduleId` | string | 是 | 日程 ID（来自 list 或 create 返回值） |

### `yach_schedule_get`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scheduleId` | string | 是 | 日程 ID |

## 测试方法

```bash
# 创建日程（经典示例）
openclaw agent --agent main --message "帮我明天上午10点建一个日程，主题是'插件联调评审'，时长1小时" 2>&1

# 查询本周日程
openclaw agent --agent main --message "查一下本周有哪些日程" 2>&1

# 查询指定人员日程
openclaw agent --agent main --message "查一下工号 A001234 下周的日程安排" 2>&1

# 查询日程详情
openclaw agent --agent main --message "查一下日程 ID xxx 的详细信息" 2>&1

# 取消日程
openclaw agent --agent main --message "取消日程 ID xxx" 2>&1
```

## 实现状态

✅ 已实现

旧实现参考：[GitLab `modules/schedule/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/schedule)
