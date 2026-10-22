# MyUniverse

基于世界对象的小说创作工作台，使用 React、TypeScript、Vite 与 Tauri 2。类结构约束人物、关系、势力、地点和事件，实例可以在卡片、Markdown、关系网、地图与聊天中使用。

文档入口是 [文档目录](docs/README.md)，产品全貌见 [总体设计](Planning.md)。文档按对象与职责分为三个模块：

| 模块 | 内容 |
| --- | --- |
| [UI](docs/ui/README.md) | 总体设计、主题和样式复用、页面与导航、插件和模型管理、聊天、工作流画布 |
| [数据结构](docs/data/README.md) | 世界对象、JSON、Markdown、视图、工作流、聊天、模型与插件配置、Skill 包 |
| [功能](docs/features/README.md) | 对象编辑、保存刷新、Function、Tool、修改提议、视图、工作流、模型、Agent、Skill、聊天及 API |

开发命令、测试入口与桌面交付见 [开发指南](docs/development.md)，实现边界和调用链见 [架构](docs/architecture.md)。需求追加、修改经过、截图、实测结果及旧文档原文统一保存在 [日志](docs/changelog/README.md)。

`npm install` 后运行 `npm run dev`；`npm test` 运行模型与服务测试，`npm run build` 构建前端，`npm run desktop:build` 构建 Windows 桌面版。完整环境要求与桌面文件位置以开发指南为准。

项目采用 [MIT License](LICENSE)，第三方资源授权保留在各资源目录。
