# Skill 包与文件格式

格式实现见 [skillPackages.ts](../../src/model/skillPackages.ts)，物理读写见 [skills.rs](../../src-tauri/src/skills.rs)。加载与能力见 [Skill 功能](../features/skills.md)，编辑入口见 [管理界面](../ui/libraries.md#skill-包编辑)。

## 标准说明文件

SKILL.md 必须以 YAML frontmatter 开头，name 与技能目录名相同，description 描述用途和触发条件。正文为 Markdown。

~~~markdown
---
name: world-review
description: 核对世界设定前后一致性时使用。
---

# 世界设定核对

先读取已知资料，必要时再读取 references/checklist.md。
~~~

name 支持 Unicode 小写字母、数字和单个短横线，1–64 个字符，禁止首尾短横线、连续短横线与 Windows 保留名。description 为 1–1024 字符；compatibility 为 1–500 字符；license、allowed-tools 为字符串，metadata 为字符串键值映射。disable-model-invocation 为可选 Boolean。未知扩展字段保留在原文。

## 目录与应用扩展

~~~text
user/skills/<name>/
  SKILL.md
  .myuniverse.json          # {version:1,id,enabled,folderId}
  scripts/
    tools.json             # Tool 配置数组，JS 配置用 sourceFile 指向源码
    tool-1.js              # execute(params)
  references/
    guide.md               # 支持嵌套相对路径
  assets/                  # 外部资源管理器维护
~~~

tools.json 的配置采用 ToolDefinition，支持 js/http。JS 配置以 sourceFile 引用 scripts 下源码，序列化时不把 code 混入 manifest；应用写出使用 tool-N.js 规范路径。无 manifest 引用的 scripts/*.js 可被扫描为专属 JS Tool，下一次应用保存仍规范化为序号路径。Skill 不得伪造 builtin: 身份或 builtin 实现。

references 为包内 .md 相对路径，不允许反斜杠、冒号、空路径组件、. 或 ..。assets 只列出路径，不注入二进制内容。桌面扫描限制最多 256 个包、每包 1024 个文本/资源项、递归深度 8、单文本文件 2 MiB，拒绝符号链接及越界路径。

## 运行目录与修订

SkillDefinition 是读取包后生成的内存目录；SkillDisk 为 {directory,files,revision,assets}。revision 用于磁盘包版本检查；Runtime Tool 返回的 version 是整个内存技能内容的指纹，同包任一受管文本改动都会使旧 version 失效。

metadata.output-schema 是 JSON Schema 字符串，声明最终结构化输出；metadata.member-required-skills 是字符串形式的技能 ID 数组，由会话管理器校验创建成员的必要技能。allowed-tools 只缩小本包专属工具的调用名集合，不授予全局工具或子 Agent。

## 保存、迁移与恢复

包在桌面 user/skills 独立保存，浏览器使用 myuniverse-skill-packages-v1；Workspace JSON 只保存 Agent 等对技能的稳定 ID 引用，不内联包正文。旧内联 Skill 迁出前保留 ID 和正文，补 frontmatter，名称冲突追加后缀；成功后剥离工作区内联内容。默认包的版本迁移见 [配置兼容](integrations.md#兼容与一次性标志)。

未修改包不重复写，外部修订冲突拒绝覆盖；修改 name 并保存会重命名目录、保留稳定 ID。格式错误包保留原文、标记 diskError 并禁用，允许 UI 修复。删除用户自建包移入 skills/.trash；移除受管参考/脚本文件保留于包内 .history；assets 不由应用保存链覆盖。单文件原子替换不构成整包或跨包事务。操作顺序和失败反馈见 [Skill 功能](../features/skills.md#保存与外部修改)。

系统技能身份 builtin-skill:* 同时标识删除保护；目录移动或重命名不解除保护。应用与桌面保存链路拒绝删除该包；普通技能仍按既有 trash/history 恢复方式删除。
