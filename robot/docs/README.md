# docs/ — 文档管理（机器人身份）

## 功能说明

以机器人身份读写知音楼文档：读取内容、追加内容、创建文档/文件夹、删除文档、管理协作者权限、获取文档链接。

> 另见 `personal/docs/` — 个人身份版本，仅支持读取和追加。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| `yach_doc_read` | 读取文档内容，支持纯文本和 Markdown 格式 |
| `yach_doc_append` | 向文档末尾追加文本内容 |
| `yach_doc_create` | 创建新文档或文件夹 |
| `yach_doc_delete` | 删除文档（不可恢复，谨慎使用） |
| `yach_doc_add_collaborator` | 为文档添加协作者（指定查看/编辑/管理权限） |
| `yach_doc_url` | 通过文档 GUID 获取可访问 URL |

## 参数说明

### `yach_doc_read` / `yach_doc_append`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_url` | string | 三选一 | 文档完整 URL |
| `guid` | string | 三选一 | 文档 GUID |
| `kn_node_id` | string | 三选一 | 知识库节点 ID |
| `format` | `'text'` \| `'markdown'` | 否 | 返回格式（仅 read 有此参数），默认 `text` |
| `content` | string | 是（append） | 要追加的文本内容 |

### `yach_doc_create`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `'newdoc'` \| `'folder'` \| `'mosheet'` \| `'presentation'` \| `'mindmap'` \| `'form'` \| `'board'` | 是 | 文档类型 |
| `name` | string | 否 | 文档名称 |
| `folder` | string | 否 | 父文件夹 GUID 或 URL（不填则创建在根目录） |

### `yach_doc_delete`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_url` | string | 是 | 文档完整 URL |

### `yach_doc_add_collaborator`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `guid` | string | 是 | 文档 GUID |
| `work_code` | string | 是 | 被授权用户的工号 |
| `role` | `'viewer'` \| `'editor'` \| `'manager'` | 否 | 权限角色，默认 `viewer` |

### `yach_doc_url`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `guid` | string | 是 | 文档 GUID |

## 测试方法

```bash
# 读取文档
openclaw agent --agent main --message "以机器人身份读取这个文档 https://yach.example.com/doc/xxxxxx" 2>&1

# 创建新文档
openclaw agent --agent main --message "创建一个新的知音楼文档，名称'2026年5月周会记录'" 2>&1

# 创建文件夹
openclaw agent --agent main --message "在知音楼创建一个文件夹，名称'项目文档'" 2>&1

# 向文档追加内容
openclaw agent --agent main --message "在文档 https://yach.example.com/doc/xxxxxx 末尾追加：'本次结论：延期两周'" 2>&1

# 添加协作者
openclaw agent --agent main --message "把工号 A001234 加为文档 guid-xxxx 的编辑者" 2>&1
```

## 实现状态

✅ 已实现

旧实现参考：[GitLab `modules/doc/`](https://haoweilai.gitlab.20020306.xyz:5890/root/yach-omni-plugin/-/tree/main/modules/doc)
