# 源码与验证入口索引

按当前仓库文件整理的逐文件导航，覆盖前端模型、服务、UI、样式、桌面桥、脚本和测试；构建产物、依赖、缓存、用户数据不作为源码。导出符号仅用于定位，完整契约以所属专题及实际实现为准。分层调用链见 [架构](architecture.md)。

## src/model

| 文件 | 主要入口 | 主专题 |
| --- | --- | --- |
| [agentExamples.ts](../src/model/agentExamples.ts) | `toolUseExampleInput`、`installToolUseTemplate`、`createToolUseExample` | [规范](features/agents.md) |
| [agentManagement.ts](../src/model/agentManagement.ts) | `AGENT_MANAGER_FOLDER`、`agentManagerTools`、`agentManagerIds` | [规范](features/agents.md) |
| [agents.ts](../src/model/agents.ts) | `defaultAgentSchema`、`agentCapability`、`agentSpec`、`agentParameters`、`agentChatReason` | [规范](features/agents.md) |
| [attributeFilter.ts](../src/model/attributeFilter.ts) | `AttributeFilter`、`INSTANCE_FILTER_KEY`、`attributeKey`、`filterDisplay`、`attributeKeys` 等 | [规范](features/editing.md) |
| [builtinAgents.ts](../src/model/builtinAgents.ts) | `REACT_AGENT_ID`、`ADVANCED_AGENT_ID`、`ROLEPLAY_AGENT_ID`、`defaultConfig`、`presetDefinition` 等 | [规范](features/agents.md) |
| [builtinSkills.ts](../src/model/builtinSkills.ts) | `GROUP_SKILL`、`ROLE_SKILL`、`NARRATOR_SKILL`、`legacyCharacterSchema`、`characterSchema` 等 | [规范](features/skills.md) |
| [builtinSkillsLegacy.json](../src/model/builtinSkillsLegacy.json) | 内置数据 / 映射 | [规范](features/skills.md) |
| [builtinSkillsPrevious.json](../src/model/builtinSkillsPrevious.json) | 内置数据 / 映射 | [规范](features/skills.md) |
| [builtinTools.ts](../src/model/builtinTools.ts) | `LEGACY_OBJECT_FOLDER`、`OBJECT_MANAGER_FOLDER`、`SKILL_MANAGER_FOLDER`、`skillManagerIds`、`builtinTools` 等 | [规范](features/tools.md) |
| [bulkEdit.ts](../src/model/bulkEdit.ts) | `CommonField`、`commonFields`、`patchCommonFields` | [规范](features/editing.md) |
| [bundledRelationshipScripts.json](../src/model/bundledRelationshipScripts.json) | 内置数据 / 映射 | [规范](features/functions.md) |
| [bundledRelationshipScripts.ts](../src/model/bundledRelationshipScripts.ts) | `jsFunctionTemplates`、`JsFunctionTemplateId`、`createJsFunction` | [规范](features/functions.md) |
| [chatDirectives.ts](../src/model/chatDirectives.ts) | `ChatDirective`、`Completion`、`completionQuery`、`completionOptions`、`activeDirectives` 等 | [规范](features/chat.md) |
| [chatMembers.ts](../src/model/chatMembers.ts) | `ChatMemberView`、`chatMembers` | [规范](features/chat.md) |
| [chatRuns.ts](../src/model/chatRuns.ts) | `editChatHistory`、`chatTarget`、`mergeChatEvents`、`updateChatMessage`、`normalizeChatRuns` | [规范](features/chat.md) |
| [collections.ts](../src/model/collections.ts) | `removeCollection` | [规范](features/editing.md) |
| [flow.ts](../src/model/flow.ts) | `flowNames`、`flowPorts`、`newFlowNode`、`createFlow`、`isFlowGraph` 等 | [规范](features/workflow-execution.md) |
| [functionAppend.ts](../src/model/functionAppend.ts) | `FunctionAppendScope`、`appendedField`、`originalFields`、`fieldPath`、`reconcileFunctionDocument` 等 | [规范](features/functions.md) |
| [functionValues.ts](../src/model/functionValues.ts) | `fieldTypedValue`、`functionContext`、`validateTypedValue`、`typedValueMarkdown`、`createFunctionApi` | [规范](features/functions.md) |
| [functions.ts](../src/model/functions.ts) | `functionFile`、`functionLink`、`parseFunctionLink`、`createFunction`、`functionRevision` 等 | [规范](features/functions.md) |
| [graphEditing.ts](../src/model/graphEditing.ts) | `EditNode`、`EditEdge`、`EditGraph`、`edgesOf`、`removeGraphSelection` 等 | [规范](features/interface-views.md) |
| [graphGeometry.ts](../src/model/graphGeometry.ts) | `GRAPH_NODE_WIDTH`、`GRAPH_NODE_HEIGHT`、`Point`、`viewportNodePosition`、`GRAPH_MIN_SCALE` 等 | [规范](features/interface-views.md) |
| [graphLayout.ts](../src/model/graphLayout.ts) | `LayoutNode`、`LayoutEdge`、`clusteredGraphLayout` | [规范](features/interface-views.md) |
| [hostWorldApi.ts](../src/model/hostWorldApi.ts) | `createHostWorldApi` | [规范](features/editing.md) |
| [instanceEditing.ts](../src/model/instanceEditing.ts) | `duplicateInstances`、`pasteInstances`、`deleteInstances` | [规范](features/editing.md) |
| [interfaceViews.ts](../src/model/interfaceViews.ts) | `currentBinding`、`schemaAtPath`、`fieldsAtPath`、`concreteField`、`bindingFields` 等 | [规范](features/interface-views.md) |
| [legacyRuntimeSkills.ts](../src/model/legacyRuntimeSkills.ts) | `RUNTIME_TOOL_FOLDER`、`RUNTIME_SKILL_FOLDER`、`SKILL_CREATOR_ID`、`legacyRuntimeTools`、`legacyRuntimeSkills` | [规范](features/skills.md) |
| [manualSave.ts](../src/model/manualSave.ts) | `CreationFile`、`saveProjection`、`dirtyTreeItems`、`dirtyEntityItems` | [规范](features/persistence.md) |
| [markdown.ts](../src/model/markdown.ts) | `markdownHeadingLevels`、`classLink`、`fieldHeading`、`fieldMarkdown`、`entityMarkdown` 等 | [规范](data/markdown.md) |
| [markdownImport.ts](../src/model/markdownImport.ts) | `fillDocumentMarkdown` | [规范](data/markdown.md) |
| [markdownParser.ts](../src/model/markdownParser.ts) | `parseDocumentMarkdown` | [规范](data/markdown.md) |
| [markdownSyntax.ts](../src/model/markdownSyntax.ts) | `escapeTextHeadings`、`Heading`、`headingTree`、`trimBlankLines` | [规范](data/markdown.md) |
| [merge.ts](../src/model/merge.ts) | `mergeThreeWay`、`sameData`、`retainReferences` | [规范](features/editing.md) |
| [modelFolders.ts](../src/model/modelFolders.ts) | `modelItems`、`modelFolderPath`、`createModelFolder`、`removeModelFolder` | [规范](features/editing.md) |
| [modelUsage.ts](../src/model/modelUsage.ts) | `ModelUsage`、`modelUsage`、`usageSummary` | [规范](features/models.md) |
| [models.ts](../src/model/models.ts) | `SYSTEM_DEFAULT_MODEL`、`createModel`、`deleteModel`、`modelReady` | [规范](features/models.md) |
| [pluginFolders.ts](../src/model/pluginFolders.ts) | `pluginSectionNames`、`createPluginFolder`、`pluginFolderPath`、`removePluginFolder` | [规范](features/editing.md) |
| [proposalMerge.ts](../src/model/proposalMerge.ts) | `mergeProposalEntity` | [规范](features/proposals.md) |
| [referenceIndex.ts](../src/model/referenceIndex.ts) | `ReferenceChoice`、`referenceIndex` | [规范](features/editing.md) |
| [referenceText.ts](../src/model/referenceText.ts) | `referenceText` | [规范](features/editing.md) |
| [runtimeSkills.ts](../src/model/runtimeSkills.ts) | `RUNTIME_TOOL_FOLDER`、`RUNTIME_SKILL_FOLDER`、`SKILL_CREATOR_ID`、`runtimeTools`、`runtimeSkills` 等 | [规范](features/skills.md) |
| [scriptEditor.ts](../src/model/scriptEditor.ts) | `ScriptLanguage`、`CodeToken`、`tokenizeScript`、`activeIdentifier`、`scriptCompletions` | [规范](features/functions.md) |
| [skillPackages.ts](../src/model/skillPackages.ts) | `skillName`、`parseSkillMarkdown`、`skillTemplate`、`newSkill`、`normalizeLegacySkill` 等 | [规范](features/skills.md) |
| [sortGeometry.ts](../src/model/sortGeometry.ts) | `sortOffsets`、`sortGroupOffsets` | [规范](ui/pages.md) |
| [templates.ts](../src/model/templates.ts) | `createWorld` | [规范](features/editing.md) |
| [textDiff.ts](../src/model/textDiff.ts) | `DiffLine`、`lineDiff` | [规范](data/markdown.md) |
| [themes.ts](../src/model/themes.ts) | `builtinThemes`、`themeFields`、`normalizeWorkspace`、`activeTheme`、`themeStyle` | [规范](ui/styles.md) |
| [treeDragHit.ts](../src/model/treeDragHit.ts) | `nearestTreeTarget` | [规范](ui/pages.md) |
| [treeMoves.ts](../src/model/treeMoves.ts) | `moveTreeItem` | [规范](ui/pages.md) |
| [treeOrder.ts](../src/model/treeOrder.ts) | `orderedTreeEntries` | [规范](ui/pages.md) |
| [types.ts](../src/model/types.ts) | `ValueType`、`KeyType`、`FieldSchema`、`FunctionLanguage`、`FlowNodeType` 等 | [规范](features/editing.md) |
| [variablePool.ts](../src/model/variablePool.ts) | `PoolEntry`、`poolEntries`、`ensureGraphVariables`、`newPoolVariable`、`clearPoolValues` 等 | [规范](features/workflow-execution.md) |
| [visitHistory.ts](../src/model/visitHistory.ts) | `VisitHistory` | [规范](ui/pages.md) |
| [workflowBindings.ts](../src/model/workflowBindings.ts) | `pairedOutput`、`bindVariable`、`unbindVariable` | [规范](features/workflow-execution.md) |
| [workflowControl.ts](../src/model/workflowControl.ts) | `ControlType`、`controlType`、`configureControl`、`configureSequence`、`validateControl` | [规范](features/workflow-execution.md) |
| [workflowDescriptions.ts](../src/model/workflowDescriptions.ts) | `workflowNodeDescription`、`flowDescriptions` | [规范](features/workflow-execution.md) |
| [workflowMigration.ts](../src/model/workflowMigration.ts) | `migrateWorkflowTypes` | [规范](features/workflow-execution.md) |
| [workflowScopes.ts](../src/model/workflowScopes.ts) | `scopeTerminal`、`newScopeGraph`、`walkWorkflowNodes`、`mapWorkflowNodes`、`graphLeaves` 等 | [规范](features/workflow-execution.md) |
| [workflowTemplates.ts](../src/model/workflowTemplates.ts) | `conversationAgent`、`multiAgentExample` | [规范](features/workflow-execution.md) |
| [workflowValues.ts](../src/model/workflowValues.ts) | `variableTypes`、`VariableType`、`ToolCall`、`ContextMessage`、`MessageValue` 等 | [规范](features/workflow-execution.md) |
| [workflows.ts](../src/model/workflows.ts) | `workflowNames`、`workflowNodeTitle`、`workflowNode`、`agentGraph`、`createAgent` 等 | [规范](features/workflow-execution.md) |
| [worldApi.ts](../src/model/worldApi.ts) | `ApiMember`、`ApiEntity`、`ApiClass`、`WorldCatalog`、`worldCatalog` 等 | [规范](features/editing.md) |

## src/services

| 文件 | 主要入口 | 主专题 |
| --- | --- | --- |
| [agentRuntime.ts](../src/services/agentRuntime.ts) | `AgentMemoryChange`、`AgentRuntime`、`AgentInvocation`、`AgentLimitError`、`isAgentLimit` 等 | [规范](features/agents.md) |
| [agentSessions.ts](../src/services/agentSessions.ts) | `validateMemberOutput`、`MemberRunner`、`AgentSession` | [规范](features/agents.md) |
| [agentSkills.ts](../src/services/agentSkills.ts) | `AgentSkillManager`、`skillCatalog` | [规范](features/skills.md) |
| [background.ts](../src/services/background.ts) | `yieldToUI`、`background` | [规范](features/persistence.md) |
| [background.worker.ts](../src/services/background.worker.ts) | 运行 / 验证入口 | [规范](features/persistence.md) |
| [backgroundTasks.ts](../src/services/backgroundTasks.ts) | `BackgroundTasks`、`executeBackgroundTask` | [规范](features/persistence.md) |
| [builtinTools.ts](../src/services/builtinTools.ts) | `runBuiltinTool` | [规范](features/tools.md) |
| [chatQuestions.ts](../src/services/chatQuestions.ts) | `ChatQuestion`、`hasChatQuestion`、`answerChatQuestion`、`askChatQuestion` | [规范](features/chat.md) |
| [comfyEvents.ts](../src/services/comfyEvents.ts) | `watchComfyEvents` | [规范](features/editing.md) |
| [functionExecutor.ts](../src/services/functionExecutor.ts) | `executeFunctionInBackground` | [规范](features/functions.md) |
| [functions.ts](../src/services/functions.ts) | `bindFunctionExecutor`、`runFunction`、`runFunctionValue`、`FunctionJob`、`functionJobs` 等 | [规范](features/functions.md) |
| [instanceProposals.ts](../src/services/instanceProposals.ts) | `ToolCallContext`、`ProposalEvent`、`onInstanceProposal`、`proposalEntity`、`emitInstanceProposal` 等 | [规范](features/proposals.md) |
| [llm.ts](../src/services/llm.ts) | `LLMMessage`、`discoverModels`、`llmBody`、`callLLMMessage`、`callLLMStream` 等 | [规范](features/models.md) |
| [modelHttp.ts](../src/services/modelHttp.ts) | `HttpRequest`、`modelStream`、`modelRequest`、`modelImage`、`apiEndpoint` | [规范](features/models.md) |
| [recompute.ts](../src/services/recompute.ts) | `recomputeFunctions` | [规范](features/persistence.md) |
| [runtimeLog.ts](../src/services/runtimeLog.ts) | `LogLevel`、`LogEntry`、`logText`、`writeLog`、`runtimeLog` 等 | [规范](features/runtime-log.md) |
| [runtimeSkills.ts](../src/services/runtimeSkills.ts) | `bindSkillRuntime`、`skillVersion`、`applySkillWrite`、`applyRuntimeFileWrite`、`runSkillRuntime` | [规范](features/skills.md) |
| [scriptHost.ts](../src/services/scriptHost.ts) | `ScriptHost`、`bindScriptHost`、`readScriptWorld`、`commitBackgroundWorld`、`commitBackgroundTool` 等 | [规范](features/functions.md) |
| [skillStorage.ts](../src/services/skillStorage.ts) | `loadSkillPackages`、`persistSkillPackages`、`workspaceArchive`、`refreshSkillPackages`、`revealSkillAssets` | [规范](features/skills.md) |
| [sse.ts](../src/services/sse.ts) | `SSEDecoder` | [规范](features/editing.md) |
| [storage.ts](../src/services/storage.ts) | `readDocumentMarkdown`、`loadWorkspace`、`checkpointWorkspace`、`saveWorkspace`、`saveAttributeConfig` 等 | [规范](features/persistence.md) |
| [structuredOutput.ts](../src/services/structuredOutput.ts) | `RESULT_TOOL`、`resultTool`、`structuredResponse` | [规范](features/agents.md) |
| [toolExecutor.ts](../src/services/toolExecutor.ts) | `executeToolInBackground` | [规范](features/tools.md) |
| [tools.ts](../src/services/tools.ts) | `bindToolExecutor`、`toolName`、`toolSpec`、`toolParameters`、`modelToolSpec` 等 | [规范](features/tools.md) |
| [workflowAgents.ts](../src/services/workflowAgents.ts) | `resolveWorkflowAgents`、`workflowAgentValue`、`agentCapabilities` | [规范](features/agents.md) |
| [workflowExecution.ts](../src/services/workflowExecution.ts) | `NodeState`、`WorkflowEvent`、`WorkflowExecution`、`emptyExecution`、`executionEvent` 等 | [规范](features/workflow-execution.md) |
| [workflowImages.ts](../src/services/workflowImages.ts) | `workflowImageAction` | [规范](features/workflow-execution.md) |
| [workflowTools.ts](../src/services/workflowTools.ts) | `resolveWorkflowTools`、`workflowToolMember` | [规范](features/workflow-execution.md) |
| [workflows.ts](../src/services/workflows.ts) | `ImageResult`、`WorkflowRun`、`WorkflowDependencies`、`workflowText`、`runAgent` 等 | [规范](features/workflow-execution.md) |

## src/ui

| 文件 | 主要入口 | 主专题 |
| --- | --- | --- |
| [AgentIcon.tsx](../src/ui/AgentIcon.tsx) | `AgentIcon` | [规范](features/agents.md) |
| [AgentSettings.tsx](../src/ui/AgentSettings.tsx) | `AgentSettings` | [规范](features/agents.md) |
| [App.tsx](../src/ui/App.tsx) | `freshField`、`syncFields`、`findSchema`、`viewIcon`、`FieldEditor` 等 | [规范](features/editing.md) |
| [AppRoot.tsx](../src/ui/AppRoot.tsx) | `AppRoot` | [规范](features/editing.md) |
| [AutoGrowTextarea.tsx](../src/ui/AutoGrowTextarea.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](features/editing.md) |
| [ChatComposerInput.tsx](../src/ui/ChatComposerInput.tsx) | `ChatComposerInput` | [规范](features/chat.md) |
| [ChatConversationTree.tsx](../src/ui/ChatConversationTree.tsx) | `ChatConversationTree` | [规范](features/chat.md) |
| [ChatExecution.tsx](../src/ui/ChatExecution.tsx) | `ChatExecution` | [规范](features/chat.md) |
| [ChatInputContext.tsx](../src/ui/ChatInputContext.tsx) | `ChatInputContext` | [规范](features/chat.md) |
| [ChatInterjection.tsx](../src/ui/ChatInterjection.tsx) | `ChatInterjection` | [规范](features/chat.md) |
| [ChatMarkdown.tsx](../src/ui/ChatMarkdown.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](features/chat.md) |
| [ChatMessageRail.tsx](../src/ui/ChatMessageRail.tsx) | `ChatMessageRail` | [规范](features/chat.md) |
| [ChatPage.tsx](../src/ui/ChatPage.tsx) | `ChatPage` | [规范](features/chat.md) |
| [ChatQuestion.tsx](../src/ui/ChatQuestion.tsx) | `ChatQuestion` | [规范](features/chat.md) |
| [ChatReferences.tsx](../src/ui/ChatReferences.tsx) | `ChatReferences` | [规范](features/chat.md) |
| [ChatUsage.tsx](../src/ui/ChatUsage.tsx) | `ChatUsage` | [规范](features/chat.md) |
| [ChatUsagePanel.tsx](../src/ui/ChatUsagePanel.tsx) | `ChatUsagePanel` | [规范](features/chat.md) |
| [ColorPicker.tsx](../src/ui/ColorPicker.tsx) | `parseArgb`、`toCssColor`、`toArgb`、`ColorPicker` | [规范](ui/styles.md) |
| [ConfigCard.tsx](../src/ui/ConfigCard.tsx) | `ConfigCard`、`ConfigCardList` | [规范](features/editing.md) |
| [CreateInterfaceDialog.tsx](../src/ui/CreateInterfaceDialog.tsx) | `CreateInterfaceDialog` | [规范](features/interface-views.md) |
| [DerivedReferenceSelect.tsx](../src/ui/DerivedReferenceSelect.tsx) | `DerivedReferenceSelect` | [规范](features/editing.md) |
| [DocumentAttributeFilter.tsx](../src/ui/DocumentAttributeFilter.tsx) | `DocumentAttributeFilter` | [规范](features/editing.md) |
| [DocumentFileActions.tsx](../src/ui/DocumentFileActions.tsx) | `useDocumentFileActions`、`GraphDocumentActions` | [规范](features/persistence.md) |
| [DocumentWorkspace.tsx](../src/ui/DocumentWorkspace.tsx) | `DocumentWorkspace` | [规范](features/persistence.md) |
| [DragCardPreview.tsx](../src/ui/DragCardPreview.tsx) | `DragCardPreview` | [规范](features/workflow-execution.md) |
| [EntityCard.tsx](../src/ui/EntityCard.tsx) | `useCardMotion`、`EntityCard` | [规范](features/editing.md) |
| [FieldCard.tsx](../src/ui/FieldCard.tsx) | `FieldCard` | [规范](features/editing.md) |
| [FileActionsContext.tsx](../src/ui/FileActionsContext.tsx) | `FileActionsContext`、`useFileActions` | [规范](features/editing.md) |
| [FlowEditor.tsx](../src/ui/FlowEditor.tsx) | `FlowEditor` | [规范](features/workflow-execution.md) |
| [FunctionBindings.tsx](../src/ui/FunctionBindings.tsx) | `FunctionBindings` | [规范](features/functions.md) |
| [FunctionCodeEditor.tsx](../src/ui/FunctionCodeEditor.tsx) | `FunctionCodeEditor` | [规范](features/functions.md) |
| [FunctionContext.tsx](../src/ui/FunctionContext.tsx) | `FunctionContext`、`useFunctions` | [规范](features/functions.md) |
| [FunctionsPage.tsx](../src/ui/FunctionsPage.tsx) | `FunctionsPage` | [规范](features/functions.md) |
| [GraphConfigPage.tsx](../src/ui/GraphConfigPage.tsx) | `GraphConfigPage` | [规范](features/interface-views.md) |
| [GraphEdge.tsx](../src/ui/GraphEdge.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](features/interface-views.md) |
| [GraphEditActions.tsx](../src/ui/GraphEditActions.tsx) | `GraphEditActions` | [规范](features/interface-views.md) |
| [GraphRelationFilter.tsx](../src/ui/GraphRelationFilter.tsx) | `GraphRelationFilter` | [规范](features/interface-views.md) |
| [InstanceLabelConfig.tsx](../src/ui/InstanceLabelConfig.tsx) | `InstanceLabelConfig` | [规范](features/editing.md) |
| [InstanceListCard.tsx](../src/ui/InstanceListCard.tsx) | `InstanceCommands` | [规范](features/editing.md) |
| [InstanceProposal.tsx](../src/ui/InstanceProposal.tsx) | `InstanceProposal` | [规范](features/proposals.md) |
| [InterfaceConfigPage.tsx](../src/ui/InterfaceConfigPage.tsx) | `InterfaceConfigPage` | [规范](features/interface-views.md) |
| [JsFunctionCreateMenu.tsx](../src/ui/JsFunctionCreateMenu.tsx) | `JsFunctionCreateMenu` | [规范](features/functions.md) |
| [LibraryFileIcon.tsx](../src/ui/LibraryFileIcon.tsx) | `LibraryAssetIcon`、`LibraryFileIcon` | [规范](ui/styles.md) |
| [LibraryFolder.tsx](../src/ui/LibraryFolder.tsx) | `LibraryExpansionContext`、`LibraryFolder` | [规范](features/workflow-execution.md) |
| [LibraryIcon.tsx](../src/ui/LibraryIcon.tsx) | `LibraryIcon` | [规范](ui/styles.md) |
| [LucideWorkflowIcons.tsx](../src/ui/LucideWorkflowIcons.tsx) | `Letters`、`ScanBox`、`FileCodeCorner`、`SquareSparkles` | [规范](ui/styles.md) |
| [MapPage.tsx](../src/ui/MapPage.tsx) | `MapPage` | [规范](features/interface-views.md) |
| [MarkdownSourceEditor.tsx](../src/ui/MarkdownSourceEditor.tsx) | `editableMarkdownText`、`MarkdownSourceEditor` | [规范](data/markdown.md) |
| [ModelFolderContents.tsx](../src/ui/ModelFolderContents.tsx) | `ModelFolderContents` | [规范](features/editing.md) |
| [ModelSelector.tsx](../src/ui/ModelSelector.tsx) | `ModelSelector` | [规范](features/editing.md) |
| [ModelWorkflowPage.tsx](../src/ui/ModelWorkflowPage.tsx) | `ModelWorkflowPage` | [规范](features/workflow-execution.md) |
| [ModelsPage.tsx](../src/ui/ModelsPage.tsx) | `CapabilitySelection`、`ModelsPage` | [规范](features/models.md) |
| [ModelsSidebar.tsx](../src/ui/ModelsSidebar.tsx) | `modelSectionNames`、`ModelsSidebar` | [规范](ui/pages.md) |
| [ObjectPicker.tsx](../src/ui/ObjectPicker.tsx) | `ObjectPicker` | [规范](features/editing.md) |
| [PageSession.tsx](../src/ui/PageSession.tsx) | `PageMemory`、`usePageState`、`usePageRef`、`PageSession` | [规范](ui/pages.md) |
| [PersonIdentity.tsx](../src/ui/PersonIdentity.tsx) | `PersonIdentity` | [规范](features/editing.md) |
| [PickerMenu.tsx](../src/ui/PickerMenu.tsx) | `PickerMenu` | [规范](features/editing.md) |
| [PluginFolderContents.tsx](../src/ui/PluginFolderContents.tsx) | `PluginFolderContents` | [规范](features/editing.md) |
| [PluginTree.tsx](../src/ui/PluginTree.tsx) | `PluginTree` | [规范](ui/pages.md) |
| [PresetAgentPage.tsx](../src/ui/PresetAgentPage.tsx) | `PresetAgentPage` | [规范](features/agents.md) |
| [ProposalGroup.tsx](../src/ui/ProposalGroup.tsx) | `ProposalGroup` | [规范](features/proposals.md) |
| [ReadOnlyFunctionValue.tsx](../src/ui/ReadOnlyFunctionValue.tsx) | `ReadOnlyFunctionValue` | [规范](features/functions.md) |
| [ReferenceOption.tsx](../src/ui/ReferenceOption.tsx) | `referenceColorStyle`、`ReferenceBadge`、`ReferenceOption` | [规范](features/editing.md) |
| [ReferencePicker.tsx](../src/ui/ReferencePicker.tsx) | `ReferencePicker` | [规范](features/editing.md) |
| [RoleplayOutput.tsx](../src/ui/RoleplayOutput.tsx) | `roleFields`、`roleContent`、`RoleplayOutput` | [规范](features/chat.md) |
| [RuntimeLogPanel.tsx](../src/ui/RuntimeLogPanel.tsx) | `RuntimeLogPanel` | [规范](features/runtime-log.md) |
| [SchemaEditor.tsx](../src/ui/SchemaEditor.tsx) | `SchemaEditor` | [规范](features/editing.md) |
| [ScriptEditor.tsx](../src/ui/ScriptEditor.tsx) | `ScriptEditor` | [规范](features/functions.md) |
| [Select.tsx](../src/ui/Select.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](features/editing.md) |
| [SettingsPage.tsx](../src/ui/SettingsPage.tsx) | `SettingsPage` | [规范](features/editing.md) |
| [SettingsSidebar.tsx](../src/ui/SettingsSidebar.tsx) | `SettingsSidebar` | [规范](ui/pages.md) |
| [SidebarActions.tsx](../src/ui/SidebarActions.tsx) | `SidebarActions` | [规范](ui/pages.md) |
| [SkillTree.tsx](../src/ui/SkillTree.tsx) | `SkillPart`、`SkillTree` | [规范](features/skills.md) |
| [SkillsPage.tsx](../src/ui/SkillsPage.tsx) | `SkillsPage` | [规范](features/skills.md) |
| [SortHandle.tsx](../src/ui/SortHandle.tsx) | `reorder`、`reorderGroup`、`SortHandle` | [规范](ui/pages.md) |
| [ToolsPage.tsx](../src/ui/ToolsPage.tsx) | `ToolsPage` | [规范](features/tools.md) |
| [TopbarActions.tsx](../src/ui/TopbarActions.tsx) | `TopbarActions` | [规范](ui/pages.md) |
| [TreeDisclosure.tsx](../src/ui/TreeDisclosure.tsx) | `TreeDisclosure` | [规范](ui/pages.md) |
| [VariablePool.tsx](../src/ui/VariablePool.tsx) | `PoolEntry`、`VariablePool` | [规范](features/workflow-execution.md) |
| [VariableTypePicker.tsx](../src/ui/VariableTypePicker.tsx) | `VariableTypePicker` | [规范](features/workflow-execution.md) |
| [ViewBindingPicker.tsx](../src/ui/ViewBindingPicker.tsx) | `ViewBindingPicker` | [规范](features/interface-views.md) |
| [WorkflowContextMenu.tsx](../src/ui/WorkflowContextMenu.tsx) | `WorkflowContextMenu` | [规范](features/workflow-execution.md) |
| [WorkflowEditor.tsx](../src/ui/WorkflowEditor.tsx) | `WorkflowEditor` | [规范](features/workflow-execution.md) |
| [WorkflowIcon.tsx](../src/ui/WorkflowIcon.tsx) | `LocalWorkflowIcon`、`WorkflowIcon`、`PortTypeIcon` | [规范](features/workflow-execution.md) |
| [WorkflowPorts.tsx](../src/ui/WorkflowPorts.tsx) | `BindingSource`、`WorkflowPorts` | [规范](features/workflow-execution.md) |
| [cardMotion.ts](../src/ui/cardMotion.ts) | `prepareCardMotion` | [规范](features/editing.md) |
| [composerDom.ts](../src/ui/composerDom.ts) | `composerText`、`composerCaret`、`setComposerCaret` | [规范](features/chat.md) |
| [dragAppearance.ts](../src/ui/dragAppearance.ts) | `preserveDragAppearance` | [规范](features/editing.md) |
| [libraryDrop.ts](../src/ui/libraryDrop.ts) | `canDropLibraryNode` | [规范](features/workflow-execution.md) |
| [libraryIconPaths.ts](../src/ui/libraryIconPaths.ts) | `libraryIconPaths` | [规范](ui/styles.md) |
| [portalTheme.ts](../src/ui/portalTheme.ts) | `portalTheme` | [规范](ui/styles.md) |
| [style.css](../src/ui/style.css) | 共享样式规则 | [规范](features/editing.md) |
| [styles/base.css](../src/ui/styles/base.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/buttons.css](../src/ui/styles/buttons.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/canvas.css](../src/ui/styles/canvas.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/cards.css](../src/ui/styles/cards.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/content.css](../src/ui/styles/content.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/fields.css](../src/ui/styles/fields.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/index.css](../src/ui/styles/index.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/layouts.css](../src/ui/styles/layouts.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/mapping.json](../src/ui/styles/mapping.json) | 内置数据 / 映射 | [规范](ui/styles.md) |
| [styles/menus.css](../src/ui/styles/menus.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/modern.css](../src/ui/styles/modern.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/overlays.css](../src/ui/styles/overlays.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/rows.css](../src/ui/styles/rows.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/surfaces.css](../src/ui/styles/surfaces.css) | 共享样式规则 | [规范](ui/styles.md) |
| [styles/tokens.css](../src/ui/styles/tokens.css) | 共享样式规则 | [规范](ui/styles.md) |
| [textareaCaret.ts](../src/ui/textareaCaret.ts) | `textareaCaret` | [规范](features/chat.md) |
| [theme.css](../src/ui/theme.css) | 共享样式规则 | [规范](features/editing.md) |
| [useCanvasEditing.ts](../src/ui/useCanvasEditing.ts) | `NodeDragBoundary`、`useCanvasEditing` | [规范](features/workflow-execution.md) |
| [useDiskMarkdown.ts](../src/ui/useDiskMarkdown.ts) | `useDiskMarkdown` | [规范](features/persistence.md) |
| [useDragCardSize.ts](../src/ui/useDragCardSize.ts) | `useDragCardSize` | [规范](features/workflow-execution.md) |
| [useEditHistory.ts](../src/ui/useEditHistory.ts) | `useEditHistory` | [规范](features/editing.md) |
| [useGraphEditing.ts](../src/ui/useGraphEditing.ts) | `useGraphEditing` | [规范](features/workflow-execution.md) |
| [useInstanceEditing.tsx](../src/ui/useInstanceEditing.tsx) | `useInstanceEditing` | [规范](features/editing.md) |
| [useNativeInteractionPolicy.ts](../src/ui/useNativeInteractionPolicy.ts) | `useNativeInteractionPolicy` | [规范](features/editing.md) |
| [useTreeDrag.ts](../src/ui/useTreeDrag.ts) | `useTreeDrag` | [规范](ui/pages.md) |
| [useVariableDrag.ts](../src/ui/useVariableDrag.ts) | `useVariableDrag` | [规范](features/workflow-execution.md) |
| [useVisitHistory.ts](../src/ui/useVisitHistory.ts) | `useVisitHistory` | [规范](ui/pages.md) |
| [useWorkspaceArchive.ts](../src/ui/useWorkspaceArchive.ts) | `useWorkspaceArchive` | [规范](features/persistence.md) |
| [useWorldEditHistory.ts](../src/ui/useWorldEditHistory.ts) | `useWorldEditHistory` | [规范](features/editing.md) |

## src-tauri/src

| 文件 | 主要入口 | 主专题 |
| --- | --- | --- |
| [function_values.py](../src-tauri/src/function_values.py) | 运行 / 验证入口 | [规范](features/functions.md) |
| [functions.rs](../src-tauri/src/functions.rs) | `execute`、`execute_with_world`、`execute_with_context`、`execute_with_context_bridge`、`python_bridge_returns_host_operations_without_writing_world_files` 等 | [规范](features/functions.md) |
| [lib.rs](../src-tauri/src/lib.rs) | `user_dir`、`safe_component`、`reveal_target`、`save_workflow_image`、`save_workflow_image_at` 等 | [规范](features/editing.md) |
| [main.rs](../src-tauri/src/main.rs) | `main` | [规范](features/editing.md) |
| [model_http.rs](../src-tauri/src/model_http.rs) | `model_http`、`server`、`desktop_json_transport_passes_auth_and_body`、`desktop_image_transport_returns_a_data_url`、`rejects_unsupported_urls_before_request` | [规范](features/models.md) |
| [model_stream.rs](../src-tauri/src/model_stream.rs) | `jobs`、`transport_error`、`pump`、`cancellable`、`model_stream` 等 | [规范](features/models.md) |
| [skills.rs](../src-tauri/src/skills.rs) | `component`、`inside`、`create_inside`、`skills_root`、`revision` 等 | [规范](features/skills.md) |
| [workflow_ws.rs](../src-tauri/src/workflow_ws.rs) | `watchers`、`watch_workflow_events`、`stop_workflow_events`、`native_event_socket_passes_auth_and_reads_execution_message` | [规范](features/workflow-execution.md) |

## scripts

| 文件 | 主要入口 | 主专题 |
| --- | --- | --- |
| [EvalSister.js](../scripts/EvalSister.js) | 运行 / 验证入口 | [规范](features/functions.md) |
| [RelationEval-void.js](../scripts/RelationEval-void.js) | 运行 / 验证入口 | [规范](features/functions.md) |
| [RelationReverseEval.js](../scripts/RelationReverseEval.js) | 运行 / 验证入口 | [规范](features/functions.md) |
| [build-desktop.ps1](../scripts/build-desktop.ps1) | 构建 / 交付脚本 | [规范](development.md) |
| [install-desktop.ps1](../scripts/install-desktop.ps1) | 构建 / 交付脚本 | [规范](development.md) |
| [test-markdown.mjs](../scripts/test-markdown.mjs) | 运行 / 验证入口 | [规范](development.md) |
| [人物关系路径推理.js](../scripts/人物关系路径推理.js) | 运行 / 验证入口 | [规范](features/functions.md) |
| [同母相邻姐妹关系.js](../scripts/同母相邻姐妹关系.js) | 运行 / 验证入口 | [规范](features/functions.md) |
| [起名器 - 副本.py](../scripts/起名器 - 副本.py) | 运行 / 验证入口 | [规范](features/functions.md) |
| [起名器.py](../scripts/起名器.py) | 运行 / 验证入口 | [规范](features/functions.md) |

## tests

| 文件 | 主要入口 | 主专题 |
| --- | --- | --- |
| [agent-runtime-ui.tsx](../tests/agent-runtime-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [agent-settings-ui.tsx](../tests/agent-settings-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [agent-ui.tsx](../tests/agent-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [agentGraph.test.ts](../tests/agentGraph.test.ts) | 内存契约回归 | [规范](development.md) |
| [agentSessions.test.tsx](../tests/agentSessions.test.tsx) | 内存契约回归 | [规范](development.md) |
| [agentSettings.test.tsx](../tests/agentSettings.test.tsx) | 内存契约回归 | [规范](development.md) |
| [attribute-filter-ui.tsx](../tests/attribute-filter-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [attributeFilter.test.ts](../tests/attributeFilter.test.ts) | 内存契约回归 | [规范](development.md) |
| [attributeFilterFixture.ts](../tests/attributeFilterFixture.ts) | `attributeFilterFixture` | [规范](development.md) |
| [builtinTools.test.ts](../tests/builtinTools.test.ts) | 内存契约回归 | [规范](development.md) |
| [bulkEdit.test.ts](../tests/bulkEdit.test.ts) | 内存契约回归 | [规范](development.md) |
| [chat-controls-ui.tsx](../tests/chat-controls-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [chatDirectives.test.tsx](../tests/chatDirectives.test.tsx) | 内存契约回归 | [规范](development.md) |
| [chatPresentation.test.ts](../tests/chatPresentation.test.ts) | 内存契约回归 | [规范](development.md) |
| [chatUsage.test.tsx](../tests/chatUsage.test.tsx) | 内存契约回归 | [规范](development.md) |
| [flow.test.ts](../tests/flow.test.ts) | 内存契约回归 | [规范](development.md) |
| [function-templates-ui.tsx](../tests/function-templates-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [functions.test.ts](../tests/functions.test.ts) | 内存契约回归 | [规范](development.md) |
| [graph-history-ui.tsx](../tests/graph-history-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [graph-layout-ui.tsx](../tests/graph-layout-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [graph-selection-ui.tsx](../tests/graph-selection-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [graph.test.ts](../tests/graph.test.ts) | 内存契约回归 | [规范](development.md) |
| [instance-actions-ui.tsx](../tests/instance-actions-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [instance-edit-ui.tsx](../tests/instance-edit-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [instance-name-ui.tsx](../tests/instance-name-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [instanceEditing.test.ts](../tests/instanceEditing.test.ts) | 内存契约回归 | [规范](development.md) |
| [interfaceViews.test.ts](../tests/interfaceViews.test.ts) | 内存契约回归 | [规范](development.md) |
| [json-runtime-ui.tsx](../tests/json-runtime-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [jsonRuntime.test.ts](../tests/jsonRuntime.test.ts) | 内存契约回归 | [规范](development.md) |
| [jsonRuntimeFixture.ts](../tests/jsonRuntimeFixture.ts) | `runtimeFixture` | [规范](development.md) |
| [library-icons-ui.tsx](../tests/library-icons-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [libraryTreeOrder.test.tsx](../tests/libraryTreeOrder.test.tsx) | 内存契约回归 | [规范](development.md) |
| [manual-save-ui.tsx](../tests/manual-save-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [manualSave.test.ts](../tests/manualSave.test.ts) | 内存契约回归 | [规范](development.md) |
| [markdown-diff-ui.tsx](../tests/markdown-diff-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [markdown.test.ts](../tests/markdown.test.ts) | 内存契约回归 | [规范](development.md) |
| [models.test.ts](../tests/models.test.ts) | 内存契约回归 | [规范](development.md) |
| [modern-ui.tsx](../tests/modern-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [multiagent-chat-ui.tsx](../tests/multiagent-chat-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [native-interaction-ui.tsx](../tests/native-interaction-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [performance-ui.tsx](../tests/performance-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [performance.test.ts](../tests/performance.test.ts) | 内存契约回归 | [规范](development.md) |
| [person-relations-ui.tsx](../tests/person-relations-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [plainMarkdown.test.ts](../tests/plainMarkdown.test.ts) | 内存契约回归 | [规范](development.md) |
| [reference-picker-ui.tsx](../tests/reference-picker-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [refresh-function-ui.tsx](../tests/refresh-function-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [relation-graph-ui.tsx](../tests/relation-graph-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [relationGraph.test.ts](../tests/relationGraph.test.ts) | 内存契约回归 | [规范](development.md) |
| [relationGraphFixture.ts](../tests/relationGraphFixture.ts) | `relationGraphFixture`、`personRepeatedFixture` | [规范](development.md) |
| [relationshipFunction.test.ts](../tests/relationshipFunction.test.ts) | 内存契约回归 | [规范](development.md) |
| [roleplayConversation.test.tsx](../tests/roleplayConversation.test.tsx) | 内存契约回归 | [规范](development.md) |
| [runtime-log-ui.tsx](../tests/runtime-log-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [runtimeLog.test.ts](../tests/runtimeLog.test.ts) | 内存契约回归 | [规范](development.md) |
| [runtimeSkills.test.tsx](../tests/runtimeSkills.test.tsx) | 内存契约回归 | [规范](development.md) |
| [script-editor-ui.tsx](../tests/script-editor-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [script-ui.tsx](../tests/script-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [scriptEditor.test.ts](../tests/scriptEditor.test.ts) | 内存契约回归 | [规范](development.md) |
| [scriptHost.test.ts](../tests/scriptHost.test.ts) | 内存契约回归 | [规范](development.md) |
| [skillPackages.test.tsx](../tests/skillPackages.test.tsx) | 内存契约回归 | [规范](development.md) |
| [sorting.test.ts](../tests/sorting.test.ts) | 内存契约回归 | [规范](development.md) |
| [sse-server.mjs](../tests/sse-server.mjs) | 运行 / 验证入口 | [规范](development.md) |
| [sse.test.ts](../tests/sse.test.ts) | 内存契约回归 | [规范](development.md) |
| [themes.test.ts](../tests/themes.test.ts) | 内存契约回归 | [规范](development.md) |
| [tree-drop-ui.tsx](../tests/tree-drop-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [tree-hit-ui.tsx](../tests/tree-hit-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [tree-ui.tsx](../tests/tree-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [treeDragHit.test.ts](../tests/treeDragHit.test.ts) | 内存契约回归 | [规范](development.md) |
| [treeMoves.test.ts](../tests/treeMoves.test.ts) | 内存契约回归 | [规范](development.md) |
| [ui-styles.tsx](../tests/ui-styles.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [view-tree-ui.tsx](../tests/view-tree-ui.tsx) | UI 内存夹具（同名 HTML 入口） | [规范](development.md) |
| [visitHistory.test.ts](../tests/visitHistory.test.ts) | 内存契约回归 | [规范](development.md) |
| [workflowEditing.test.ts](../tests/workflowEditing.test.ts) | 内存契约回归 | [规范](development.md) |
| [workflowExecution.test.ts](../tests/workflowExecution.test.ts) | 内存契约回归 | [规范](development.md) |
| [workflowStructure.test.ts](../tests/workflowStructure.test.ts) | 内存契约回归 | [规范](development.md) |
| [workflowTools.test.ts](../tests/workflowTools.test.ts) | 内存契约回归 | [规范](development.md) |
| [workflows.test.ts](../tests/workflows.test.ts) | 内存契约回归 | [规范](development.md) |

## 工具职能与目录许可

| 文件 | 职责 | 规范 |
| --- | --- | --- |
| [toolRoles.ts](../src/model/toolRoles.ts) | 工具职能、已移除身份、系统目录判定 | [Tool](features/tools.md) |
| [agentCapabilityDefaults.ts](../src/model/agentCapabilityDefaults.ts) | 首次默认目录许可和调用级展开 | [Agent](features/agents.md) |
| [ToolIcon.tsx](../src/ui/ToolIcon.tsx) | 树、集合和聊天共用职能图标 | [样式](ui/styles.md) |
| [AgentToolSelection.tsx](../src/ui/AgentToolSelection.tsx) | 系统工具按文件夹整组选取 | [管理界面](ui/libraries.md) |
| [toolCategories.test.tsx](../tests/toolCategories.test.tsx) | 目录保护、默认许可、交互门控和文件确认回退 | [验证](development.md) |
| [tool-categories-ui.tsx](../tests/tool-categories-ui.tsx) | 内存 UI 验收夹具 | [验证](development.md) |

## 启动、配置与资源

- [src/main.tsx](../src/main.tsx)
- [package.json](../package.json)
- [vite.config.ts](../vite.config.ts)
- [tsconfig.json](../tsconfig.json)
- [src-tauri/Cargo.toml](../src-tauri/Cargo.toml)
- [src-tauri/tauri.conf.json](../src-tauri/tauri.conf.json)
- [index.html](../index.html)
- [src/assets/library-icons/README.md](../src/assets/library-icons/README.md)
- [src/assets/workflow-icons/README.md](../src/assets/workflow-icons/README.md)

图标授权与 SVG 原件留在资源目录；自动生成的 src-tauri/gen/schemas 来自 Tauri，不作为手写接口契约。tests/fixtures 的 Markdown 是业务输入，HTML 是夹具壳层，和同名 TSX 一起阅读。源码核对时文件哈希保存在 [整理日志](changelog/2026-10-21-documentation.md)，仅用于定位本次读取范围。
