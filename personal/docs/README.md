# docs/ — 文档读写（个人身份）

## 功能说明

以当前扫码登录用户身份读取或追加知音楼文档内容。通过文档 URL、GUID 或知识库节点 ID 定位文档。

> 另见 `robot/docs/` — 机器人身份版本，功能更全（含创建、删除、协作者管理）。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_personal_doc_read` | 读取文档内容，支持纯文本和 Markdown 格式 |
| `yach_personal_doc_append` | 向文档末尾追加文本内容 |

## 参数说明

### `yach_personal_doc_read`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_url` | string | 三选一 | 文档完整 URL |
| `guid` | string | 三选一 | 文档 GUID |
| `kn_node_id` | string | 三选一 | 知识库节点 ID |
| `format` | `'text'` \| `'markdown'` | 否 | 返回格式，默认 `text` |

### `yach_personal_doc_append`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_url` | string | 三选一 | 文档完整 URL |
| `guid` | string | 三选一 | 文档 GUID |
| `kn_node_id` | string | 三选一 | 知识库节点 ID |
| `content` | string | 是 | 要追加的文本内容 |

## 测试方法

```bash
# 读取文档（替换为真实文档 URL）
openclaw agent --agent main --message "读取这个文档的内容 https://yach.example.com/doc/xxxxxx" 2>&1

# 以 Markdown 格式读取
openclaw agent --agent main --message "用 Markdown 格式读取文档 https://yach.example.com/doc/xxxxxx" 2>&1

# 追加内容到文档
openclaw agent --agent main --message "在文档 https://yach.example.com/doc/xxxxxx 末尾追加：'本次会议结论：延期两周'" 2>&1
```

## 实现状态

✅ 已实现

旧实现参考：[GitLab](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin)
