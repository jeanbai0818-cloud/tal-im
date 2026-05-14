# chat-group/ — 群组管理

## 功能说明

以机器人身份管理知音楼群聊：获取机器人所在群列表、创建群、增删成员、查询成员列表。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_group_list_robot_groups` | 获取当前机器人所在的所有群列表（返回群 ID 和群名称） |
| `yach_group_create` | 创建群聊，指定群名称和群主 |
| `yach_group_add_members` | 向群添加成员 |
| `yach_group_remove_members` | 从群移除成员 |
| `yach_group_list_members` | 查询群成员列表 |

## 参数说明

### `yach_group_list_robot_groups`

无参数。

### `yach_group_create`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 群名称 |
| `owner_user_id` | string | 是 | 群主的知音楼用户 ID |
| `member_user_ids` | string[] | 否 | 初始成员用户 ID 列表（自动包含群主） |

### `yach_group_add_members` / `yach_group_remove_members`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `group_id` | string | 是 | 群 ID（来自 list_robot_groups） |
| `user_ids` | string[] | 是 | 要操作的用户 ID 列表 |
| `op_uid` | string | 是 | 操作者的知音楼用户 ID（需有管理权限） |

### `yach_group_list_members`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `group_id` | string | 是 | 群 ID |

## 测试方法

```bash
# 查看机器人所在群列表
openclaw agent --agent main --message "列出机器人所在的所有群" 2>&1

# 查询群成员
openclaw agent --agent main --message "查一下群 xxx 的成员列表" 2>&1

# 创建群
openclaw agent --agent main --message "创建一个名为'测试群'的群，群主用户ID是 yach12345" 2>&1

# 向群添加成员
openclaw agent --agent main --message "把用户 yach67890 加入群 xxx，操作者是 yach12345" 2>&1
```

## 实现状态

✅ 已实现

