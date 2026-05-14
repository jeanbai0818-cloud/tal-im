# mail/ — 邮件（个人身份）

## 功能说明

以当前扫码登录用户身份收发知音楼邮件：发送邮件、查看收件箱、按主题关键字搜索。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_mail_send` | 发送邮件，支持多收件人和抄送 |
| `yach_mail_inbox` | 列出收件箱最新邮件 |
| `yach_mail_search` | 按主题关键字搜索邮件 |

## 参数说明

### `yach_mail_send`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `to` | string | 是 | 收件人邮箱，多个地址用英文分号或换行分隔 |
| `subject` | string | 是 | 邮件主题 |
| `body` | string | 是 | 邮件正文（纯文本） |
| `cc` | string | 否 | 抄送地址，多个地址用分号或换行分隔 |

### `yach_mail_inbox`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | number | 否 | 返回条数，默认 20，最大 50 |

### `yach_mail_search`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 是 | 搜索关键字（匹配邮件主题） |
| `limit` | number | 否 | 返回条数，默认 20 |

## 测试方法

```bash
# 发送邮件
openclaw agent --agent main --message "给 test@example.com 发一封邮件，主题'插件测试'，内容'这是一封测试邮件'" 2>&1

# 查看收件箱
openclaw agent --agent main --message "帮我看一下知音楼收件箱最新的10封邮件" 2>&1

# 搜索邮件
openclaw agent --agent main --message "在知音楼邮箱里搜一下主题包含'周报'的邮件" 2>&1
```

## 实现状态

✅ 已实现

