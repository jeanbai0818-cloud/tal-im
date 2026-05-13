# TAL 知音楼插件 (yach-tal-im)

OpenClaw 平台的**知音楼（Zhiyinlou/Yach）**全功能插件，面向好未来（TAL Education）企业用户。支持数字伙伴机器人接入、个人扫码登录两种身份，覆盖 IM 消息、日历、文档、OKR、周报、考勤、通讯录、会议室、邮件等核心企业场景。

---

## 必读：凭证要求

安装前请确认已具备以下凭证，否则插件无法工作：

| 凭证 | 用途 | 获取方式 |
|------|------|---------|
| **AppKey**（必须） | 机器人身份鉴权，所有 `robot/` 工具依赖 | 知音楼开放平台 → 数字伙伴应用 → AppKey |
| **AppSecret**（必须） | 与 AppKey 配对，用于获取 AccessToken | 同上 |
| **QR 扫码 session**（可选） | 个人身份工具（考勤/邮件/会议室等）依赖 | `openclaw config` 向导中扫码登录 |

> AppKey/AppSecret 由好未来知音楼开放平台颁发，仅限企业内部使用。**不要在公共或共享环境中配置个人 QR session。**

---

## 必读：安全配置

### 1. 默认访问控制：扫码配对（pairing）

本插件默认 DM 策略为 **`pairing`（配对模式）**，而非 open。配对模式的工作方式与知音楼扫码验身的原则一致：**陌生用户必须先完成身份确认，才能与机器人交互。**

**配对流程：**
1. 未配对用户向机器人发消息 → 机器人自动回复配对申请码
2. 管理员通过 OpenClaw 审批该申请：`openclaw channels approve`
3. 审批通过后，该用户才能正常使用机器人

这与知音楼扫码登录的逻辑相同——显式身份验证 → 授权通过 → 才能访问。

**如需更严格的控制，可改为 allowlist（仅白名单用户）：**

```json
{
  "channels": {
    "yach": {
      "dmPolicy": "allowlist",
      "allowFrom": ["<允许的userId或工号>"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["<允许的群ID>"]
    }
  }
}
```

### 2. 使用最小权限的 Yach 应用

机器人凭证可访问全员日历、文档、OKR。建议在知音楼开放平台为该数字伙伴应用**仅开启实际用到的 API 权限**，不要申请全量权限。

### 3. 破坏性操作（内置 high-risk 标记）

以下工具在插件内已注册为 `risk: high`，OpenClaw 会在 agent 执行前触发审批流程：

- `yach_doc_delete` — 删除文档（不可恢复）
- `yach_mail_send` — 以个人身份发送邮件
- `yach_group_remove_members` — 移除群成员
- `yach_schedule_cancel` — 取消日程
- `yach_meeting_cancel` — 取消会议室预订
- `yach_attendance_punch_offduty` — 写入考勤打卡记录

以下工具注册为 `risk: medium`，影响范围较小但仍有副作用：`yach_doc_append`、`yach_personal_doc_append`、`yach_doc_create`、`yach_doc_add_collaborator`、`yach_group_create`、`yach_group_add_members`、`yach_meeting_book`、`yach_schedule_create`。

### 4. 个人 QR Session 保护

个人工具的 session 存储在 `~/.openclaw/identity/`。请确保：
- 该目录权限为 `700`（仅本人可读）
- 测试时使用独立的 `OPENCLAW_STATE_DIR`，避免与生产 session 混用
- 不再使用时及时撤销 session

---

## 安装

```bash
openclaw plugins install clawhub:yach-tal-im
openclaw config   # 配置 AppKey/AppSecret + 可选扫码登录
openclaw gateway restart
```

---

## 凭证类型

| 身份类型 | 凭证来源 | 适用场景 |
|---------|---------|---------|
| **机器人身份** | AppKey + AppSecret | 代表数字伙伴机器人操作企业资源 |
| **个人身份** | QR 扫码登录 | 以本人身份操作（考勤/邮件/会议室等） |

---

## 工具列表

### 🤖 机器人身份工具（需配置 AppKey/AppSecret）

#### IM 消息

| 工具名 | 功能 |
|--------|------|
| `yach_im_send` | 向群聊或单聊发送消息（文本/Markdown/图片/文件/视频） |
| `yach_im_recall` | 撤回已发送的消息 |
| `yach_im_history` | 查询群聊历史消息记录（按时间范围分页） |
| `yach_im_group_info` | 查询群聊基本信息（名称、群主、成员列表） |

#### 日历

| 工具名 | 功能 |
|--------|------|
| `yach_schedule_list` | 查询指定时段内的日程列表，支持按工号筛选 |
| `yach_schedule_create` | 创建日程（会议、提醒等），支持设置参与者和地点 |
| `yach_schedule_cancel` | 取消/删除日程 ⚠️ |
| `yach_schedule_get` | 查询单条日程的详细信息 |

#### 文档

| 工具名 | 功能 |
|--------|------|
| `yach_doc_read` | 读取知音楼文档内容（纯文本或 Markdown 格式） |
| `yach_doc_append` | 向文档末尾追加内容 |
| `yach_doc_create` | 创建新文档/文件夹/表格/演示/脑图/表单/白板 |
| `yach_doc_delete` | 删除文档 ⚠️ 不可恢复 |
| `yach_doc_add_collaborator` | 为文档添加协作者（查看/编辑/管理权限） |
| `yach_doc_url` | 通过 GUID 获取文档访问 URL |

#### OKR

| 工具名 | 功能 |
|--------|------|
| `yach_okr_list` | 查询指定员工或部门的 OKR 列表（支持时间范围筛选） |

#### 周报

| 工具名 | 功能 |
|--------|------|
| `yach_weekly_list` | 查询员工/部门/分组的周报列表（支持未读过滤） |

#### 用户与群组

| 工具名 | 功能 |
|--------|------|
| `yach_user_search` | 按姓名/工号/邮箱搜索用户 |
| `yach_user_get` | 按 userId 或工号精确查询用户详情 |
| `yach_group_list_robot_groups` | 列出机器人所在的所有群聊 |
| `yach_group_create` | 创建群聊（指定群主和初始成员） |
| `yach_group_add_members` | 向群聊添加成员 |
| `yach_group_remove_members` | 从群聊移除成员 ⚠️ |
| `yach_group_list_members` | 查询群聊成员列表 |

---

### 👤 个人身份工具（需扫码登录）

#### 考勤

| 工具名 | 功能 |
|--------|------|
| `yach_attendance_punch_offduty` | 打下班卡（可指定打卡地址） |
| `yach_attendance_doctor` | 查询考勤记录和异常信息 |

#### 文档（个人身份）

| 工具名 | 功能 |
|--------|------|
| `yach_personal_doc_read` | 以个人身份读取文档内容 |
| `yach_personal_doc_append` | 以个人身份向文档追加内容 |

#### 邮件

| 工具名 | 功能 |
|--------|------|
| `yach_mail_send` | 以个人身份发送邮件（支持多收件人、抄送）⚠️ |
| `yach_mail_inbox` | 查看最新收件箱邮件 |
| `yach_mail_search` | 按主题关键字搜索邮件 |

#### 会议室

| 工具名 | 功能 |
|--------|------|
| `yach_meeting_search_rooms` | 查询可用会议室（按时段/城市/关键字筛选） |
| `yach_meeting_book` | 预订会议室 |
| `yach_meeting_cancel` | 取消会议室预订 ⚠️ |

#### OKR（个人身份）

| 工具名 | 功能 |
|--------|------|
| `yach_personal_okr_list` | 查询本人或指定员工/部门的 OKR 列表 |

#### 周报（个人身份）

| 工具名 | 功能 |
|--------|------|
| `yach_personal_weekly_list` | 查询周报列表，支持未读过滤和分页 |

#### 通讯录

| 工具名 | 功能 |
|--------|------|
| `yach_org_search` | 从本地通讯录快照搜索员工（姓名/工号/部门） |
| `yach_org_dept` | 按部门名称搜索部门，或列出部门直属成员 |
| `yach_org_peers` | 查找某人并列出其同部门同事 |

> ⚠️ 标记的工具已注册为 `risk: high`，OpenClaw 会在执行前要求审批。

---

## 快速上手

### 1. 安装并配置

```bash
openclaw plugins install clawhub:yach-tal-im
openclaw config
# 选择 "TAL 知音楼"，输入 AppKey 和 AppSecret
# 可选：完成扫码登录以启用个人身份工具
openclaw gateway restart
```

### 2. 立即配置访问控制

参见上方「安全配置」章节，将 `dmPolicy` 改为 `allowlist`。

### 3. 示例对话

```
你：帮我明天下午 3 点到 4 点建一个日程，主题是「插件联调评审」
你：帮我打一个下班卡
你：查一下本月的考勤记录
你：帮我搜一下同事张三的通讯录信息
你：把 OKR 文档里第三季度目标后面追加一条：完成知音楼插件 v2 重构
```

---

## 技术架构

```
core/          基建层：频道接入、QR 登录、机器人鉴权、OAPI 客户端
personal/      个人身份功能层：依赖扫码 session（~/.openclaw/identity）
robot/         机器人身份功能层：依赖 AppKey/AppSecret
```

- **Channel SDK**：长链接实时消息监听，支持 AES 解密和消息去重
- **QR 登录**：MD5 签名 + 轮询确认，session 持久化至本地
- **机器人鉴权**：AppKey/AppSecret → AccessToken，带自动续期

---

## 兼容性

- OpenClaw `>=2026.5.0`
- 好未来知音楼（Zhiyinlou）企业版
- macOS / Linux / Windows

---

## 源码

[GitHub: jeanbai0818-cloud/tal-im](https://github.com/jeanbai0818-cloud/tal-im)
