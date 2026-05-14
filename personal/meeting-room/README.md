# meeting-room/ — 会议室（个人身份）

## 功能说明

以当前扫码登录用户身份查询可用会议室、预订和取消会议室。

> 另见 `robot/meeting-room/` — 机器人身份版本（🚧 待实现）。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_meeting_search_rooms` | 查询指定日期/时段的可用会议室，可按办公区、城市、关键字过滤 |
| `yach_meeting_book` | 预订会议室（建议先用 search_rooms 确认名称） |
| `yach_meeting_cancel` | 按预订 ID 取消会议室预订 |

## 参数说明

### `yach_meeting_search_rooms`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `date` | string | 是 | 日期，格式 `YYYY-MM-DD` |
| `start` | string | 是 | 开始时间，格式 `HH:MM` |
| `end` | string | 是 | 结束时间，格式 `HH:MM` |
| `office` | string | 否 | 办公区名称，如 `"望京"` |
| `city` | string | 否 | 城市名称（office 不唯一时补充） |
| `keyword` | string | 否 | 会议室名称关键字 |
| `free_only` | boolean | 否 | 仅返回空闲会议室，默认 `true` |

### `yach_meeting_book`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `date` | string | 是 | 日期，格式 `YYYY-MM-DD` |
| `start` | string | 是 | 开始时间，格式 `HH:MM` |
| `end` | string | 是 | 结束时间，格式 `HH:MM` |
| `room` | string | 是 | 会议室名称或 ID（需精确匹配） |
| `title` | string | 是 | 会议标题 |
| `office` | string | 否 | 办公区（room 不唯一时辅助定位） |
| `city` | string | 否 | 城市 |
| `remark` | string | 否 | 备注 |

### `yach_meeting_cancel`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `meeting_id` | string | 是 | 预订 ID（数字字符串，来自 book 返回值） |

## 测试方法

```bash
# 查询明天下午可用会议室
openclaw agent --agent main --message "帮我查一下明天下午2点到3点望京有哪些空闲会议室" 2>&1

# 预订会议室（先查询再预订）
openclaw agent --agent main --message "帮我预订明天下午2点到3点望京的XX会议室，会议名'插件联调'" 2>&1

# 取消预订
openclaw agent --agent main --message "取消会议室预订，预订ID是 123456" 2>&1
```

## 实现状态

✅ 已实现

