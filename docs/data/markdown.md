# Markdown 内容格式

Markdown 是供用户阅读、分享和外部编辑的展示文件；完整对象、稳定身份、引用含义和函数来源由工作区 JSON 保存。文件布局见 [JSON 存储](json-storage.md)，操作流程见 [持久化功能](../features/persistence.md)。

## 展示结构

```markdown
# 人物

## 角色一

### 人物性格

谨慎

### 人物势力

#### 势力名称

示例势力
```

一级标题为类名，二级标题为实例名，三级及更深的标题为成员 Key，正文为 Value；Object 递归子标题，Null 不写正文。类名与 fileName 分开，默认“人物 / 人物列表.md”是合法映射。

Class 类型的键和值仅展示实例名，不输出实例引用超链接或旧函数引用后缀。Text/Content 的用户正文仍保留其原本的链接、代码和格式，不能因为文字恰好是一个实例名就改成 Class。数值与日期以文本展示，属性配置决定类型，不能凭数字外观推断结构。

Content 内的标题通过转义与代码围栏规则保留，不当作新的对象结构。placeholder 属于 Schema；动态 Class 空项可保留空标题、唯一模板的 placeholder/key 或“新属性”，不会新增声明。

### Function 生成成员与来源元数据

函数生成的成员使用与普通成员相同的标题、正文和子标题，不输出任何函数名注释、来源索引、函数链接或执行元数据。对象卡片仍显示“函数名 →”；`functionOrigin`、`functionRuns`、绑定和成员 ID 均保存在 JSON 中。

相同 Markdown 无法凭空恢复函数所有权。所有本次导入命中的值均属于用户内容；即使值相同，也清除既有函数来源与执行记录。未导入的分支保持原样。旧注释和来源索引兼容输入，但填入导入不信任这些标记来创建所有权。

## 刷新、导入与填入 JSON

三个入口均依照当前 JSON 属性配置解析，后台校验后逐实例提交，不反推或覆盖 Schema，不执行函数。

| 入口 | 内容处理 | 函数来源 |
| --- | --- | --- |
| 刷新 | 读取当前对应 MD，替换目标类内容 | 根据原 JSON 匹配的稳定成员保留函数来源，内容修改后仍视为原函数成员 |
| 导入 MD | 选择 MD，替换目标类内容 | 清除导入成员的函数来源与执行记录 |
| 填入 MD | 选择 MD，仅追加新实例、重复成员与对象子项，不改旧值 | 新增成员无来源，旧成员不变 |

替换时实例与重复成员的数量和顺序依照 MD；缺失实例和重复成员删除，缺失固定成员恢复空值及必要结构。成员匹配优先保留相同结构和值的身份，再按 Schema、键及原出现顺序匹配，避免重复成员借用错误 ID。填入不覆盖既有固定值，相同内容不重复添加。只有一级标题的有效空文档可通过刷新/导入清空实例；全部属性均不匹配配置时拒绝覆盖。

函数来源只存 JSON；MD 中的旧注释不建立来源。“重新计算函数”独立使用 JSON 执行计算，不读取 MD。

Class 键和值依据 Schema.classId 在目标类内解析实例名，使用完整世界目录；同名文字在其他类中不会影响该位置的类型。支持本次文档内新实例的前向/相互引用。找不到目标或存在同名歧义时明确报错，不猜测引用。跨文件新增目标应先导入目标类。

一级标题下的无实例正文、重复实例名、未闭合代码块和不合法的类型值会阻止整个文档进入提交；未知属性及其子树不扩展 Schema。非重复成员的多余同级标题忽略。已有“内容”成员可接收实例/对象直接正文；没有配置时不会凭空创建“内容”属性。

整份文档校验成功后逐实例发布。取消保留已完成实例；导入期间的界面编辑按稳定 ID 三方合并，冲突拒绝覆盖。实例标签和颜色继续只存 JSON。

## 转换入口

[`documentMarkdown`、`entityMarkdown`、`fieldMarkdown`、`exportFiles`](../../src/model/markdown.ts) 负责纯文本展示；[`fillDocumentMarkdown`](../../src/model/markdownImport.ts) 负责填入 JSON；[`markdownSyntax`](../../src/model/markdownSyntax.ts) 共用标题、围栏与转义规则。Worker 的 parse 默认使用替换入口；刷新设置 `preserveFunctionOrigin:true`，填入设置 `replaceContents:false, appendOnly:true`。

[`parseDocumentMarkdown`](../../src/model/markdownParser.ts) 的严格替换模式供脚本事务校验和修改建议使用，继续检查生成成员只读和未知结构边界；显式 `mode: 'fill'` 使用填入规则。刷新调用填入解析器的替换模式，并保留原 JSON 的函数来源。

正文与身份验证见 tests/plainMarkdown.test.ts、tests/markdown.test.ts；具体交付记录见 [日志](../changelog/README.md)。
