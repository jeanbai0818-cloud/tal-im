# TAL 知音楼插件 (yach-tal-im)

OpenClaw 平台的**知音楼（Zhiyinlou/Yach）**全功能插件，面向好未来（TAL Education）企业用户。支持数字伙伴机器人接入、个人扫码登录两种身份，覆盖 IM 消息、日历、文档、OKR、周报、考勤、通讯录、会议室、邮件等核心企业场景。

---

## 安装

```bash
openclaw plugins install clawhub:yach-tal-im
```

安装后运行 `openclaw config` 完成频道配置（AppKey/AppSecret + 可选扫码登录）。

---

## 凭证类型

本插件支持两种身份，工具按归属分层：

| 身份类型 | 凭证来源 | 适用场景 |
|---------|---------|---------|
| **机器人身份** | `openclaw config` 配置 AppKey + AppSecret | 代表数字伙伴机器人操作，可访问任意员工的日历/文档/OKR 等 |
| **个人身份** | `openclaw config` 扫码登录 | 以本人身份操作，用于考勤打卡、个人邮件、会议室预订等 |

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
| `yach_schedule_cancel` | 取消/删除日程 |
| `yach_schedule_get` | 查询单条日程的详细信息 |

#### 文档

| 工具名 | 功能 |
|--------|------|
| `yach_doc_read` | 读取知音楼文档内容（纯文本或 Markdown 格式） |
| `yach_doc_append` | 向文档末尾追加内容 |
| `yach_doc_create` | 创建新文档/文件夹/表格/演示/脑图/表单/白板 |
| `yach_doc_delete` | 删除文档（不可恢复，谨慎使用） |
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
| `yach_group_remove_members` | 从群聊移除成员 |
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
| `yach_mail_send` | 以个人身份发送邮件（支持多收件人、抄送） |
| `yach_mail_inbox` | 查看最新收件箱邮件 |
| `yach_mail_search` | 按主题关键字搜索邮件 |

#### 会议室

| 工具名 | 功能 |
|--------|------|
| `yach_meeting_search_rooms` | 查询可用会议室（按时段/城市/关键字筛选） |
| `yach_meeting_book` | 预订会议室 |
| `yach_meeting_cancel` | 取消会议室预订 |

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

---

## 快速上手

### 1. 安装插件并配置机器人凭证

```bash
openclaw plugins install clawhub:yach-tal-im
openclaw config
# 选择 "TAL 知音楼"，输入 AppKey 和 AppSecret
```

### 2. 扫码登录（个人身份工具）

在 `openclaw config` 向导中选择扫码登录步骤，用知音楼手机端扫码即可。

### 3. 重启网关

```bash
openclaw gateway restart
```

### 4. 示例对话

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

[GitLab: root/tal-im](https://haoweilai.gitlab.20020306.xyz:5890/root/tal-im)
