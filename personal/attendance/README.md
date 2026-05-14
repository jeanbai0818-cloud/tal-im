# attendance/ — 考勤打卡

## 功能说明

以当前扫码登录用户身份在知音楼执行**下班打卡**，并提供考勤环境诊断工具。

> 注意：当前仅支持下班打卡，不支持上班打卡。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_attendance_punch_offduty` | 执行下班打卡，可选指定打卡地址 |
| `yach_attendance_doctor` | 诊断考勤打卡环境（Python 运行时、bridge 连通性、session 状态等），不执行真实打卡 |

## 参数说明

### `yach_attendance_punch_offduty`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `address` | string | 否 | 打卡地址，如 `"北京市昌平区安居路靠近好未来大楼"`；不填则使用考勤系统返回的默认位置 |

### `yach_attendance_doctor`

无参数。

## 测试方法

```bash
# 下班打卡（使用默认位置）
openclaw agent --agent main --message "帮我在知音楼下班打卡" 2>&1

# 下班打卡（指定地址）
openclaw agent --agent main --message "帮我在知音楼下班打卡，地址是北京市昌平区安居路" 2>&1

# 环境诊断（打卡失败时先跑这个）
openclaw agent --agent main --message "诊断一下知音楼考勤打卡环境，看看有没有问题" 2>&1
```

## 实现状态

✅ 已实现

