# 桌面架构与执行流程

主应用是 Electron + Node/DSH + FreeCAD GUI 内 Python 执行器。原来的网页/CadQuery 方案完整保留在[原型说明](prototype.md)，与桌面各自保存数据；只有 DSH 传输与独立 Node 检测共用实现。

## 目录与依赖

桌面源码按窗口/UI、应用、Agent、规则、CAD 适配与基础设施分层，完整目录表见[桌面入口](../desktop/README.md)。开发定位、命令和提交约定见[开发指南](development.md)。

- `shell/` 组织窗口和 IPC，调用 `application/` 与 CAD 适配器。
- `application/` 组织会话与计划，调用 `agent/`、`domain/`、CAD 契约和共享 Harness。
- `agent/` 组织模型工具/配置/增量事件，通过 CAD 适配器读取和准备操作。
- `domain/` 只处理数据规则；`infrastructure/` 提供路径与文件写入。
- `cad/freecad/` 负责 Node 协议，`freecad/` 在 CAD GUI 线程执行。
- `shared/` 不依赖应用；桌面生产代码不依赖 `cad-studio/`。

`desktop/main.mjs` 等原入口继续转发，以兼容启动脚本和已有 profile。已安装组件引用的 Python、提示词、技能和目录路径保留，用户 `.data/` 不迁移。

桌面提供完整工作台与悬浮小窗，通过明确的类型化原生接口或旧参数配方操作FreeCAD。v1.2.0原生66项接口的来源、契约、事务和边界见[原生接口](native-interfaces.md)，旧配方见[原生设计指南](native-designs.md)，完整交互见[桌面Harness规格](desktop-harness.md)。

## 桌面实现

`scripts/start-desktop.mjs` 启动 Electron 45.3.1；`desktop/shell/main.mjs` 管理唯一 BrowserWindow、快捷键、原生文件对话框和 IPC。`desktop/preload.cjs` 只暴露固定操作，renderer 使用 contextIsolation、sandbox，禁用 Node 集成、外部导航和新窗口；本地页面有 CSP，不直接访问凭据、文件系统或网络。

`desktop/ui/` 使用同一 DOM 切换完整与紧凑布局，不刷新、不重复提交。主进程 `Session` 是会话与任务的唯一来源，统一持久化消息、草稿、附件索引和任务状态。恢复时清除未完成计划，保留对话与草稿；CAD 上下文重新读取，不当成已恢复执行。

`desktop/application/session.mjs` 识别精确示例指令；其他消息通过DSH与按数据目录隔离的 `gouxing-desktop-<摘要>` profile。`freecad_propose` 只输出计划；`freecad_inspect`、`freecad_capture` 只读工程和视口，`skill_read` 按需读取启用技能。Agent 不能执行任意代码。`desktop/domain/design.mjs` 校验尺寸算式、组件与特征，确认前显示参数差异和涉及零件。每轮模型进程结束后释放，最近对话作为上下文补入，不跨轮保持同一个DSH子进程。

`desktop/agent/tools.mjs` 订阅 DSH `agent/assistant-stream`、`tools/execute` 和 `tools/result`，在同一 JSON-RPC 行协议中转发 `gouxing.stream/tool/observation` 通知。原SDK的 `session.event` 提供最终内容及结束原因。`desktop/agent/stream.mjs` 依 attempt/index 组装真实 text/reasoning/tool-call 增量、去重与标记放弃的输出，以持久化 assistant/message 校正文段；识别 max-tokens 并单独提示。Session 约32ms合并通知，shell 通过独立 harness:stream 只发送当前回复，不重复发送历史、CAD上下文或截图；观察图片单独走状态更新。结束时持久化。取消保留已生成内容，重启标记已保存的未完成消息；尚无逐增量崩溃恢复，不伪造隐藏思考。

`desktop/ui/messages.mjs` 按消息与内容块保留节点，追加文字，保留 summary、展开状态及思考文字选择；不用整段历史的 JSON 序列化判断变化。最终提示与思考独立显示。`ui/scroll.mjs` 记录跟随意图，布局变化后滚动，并为被遮挡窗口的动画帧暂停提供定时备用。翻阅历史时保持位置，发送或点击“回到最新”恢复跟随。格式化只构造 DOM 文本节点，不解析模型 HTML 或本机图片链接。

`desktop/agent/config.mjs` 管理私有 `agent.json` 和本机技能目录；每轮固定工具白名单，任务进行中禁止修改。内置 `desktop/skills/*/SKILL.md` 与导入的纯说明文件按需加载，不赋予执行脚本/MCP的能力。截图在 CAD GUI 线程调用原生 `saveImage`，临时关闭视角动画、取图后恢复相机与动画设置；检测近似空白图，不改变几何/选择。图片经 DSH attachment store 转为 image block；依据实际路由的 inputModalities 决定是否提供图像。私有 PNG 与相机来源记录在桥接目录；当前 UI 图片仅保留在内存，不把 base64 写进会话文件。详见[Agent 能力配置](agent-tools.md)。

`shared/node-runtime.mjs` 选择并探测独立Node：启动器通过 `GOUXING_NODE_EXE` 传递自身Node路径，Harness在子进程启动前检查版本、发行类型以及不存在Electron标识；直接运行Electron时可从PATH查找Node。DSH子进程不再使用Electron的 `process.execPath`，不继承 `ELECTRON_RUN_AS_NODE`。原生插件不兼容错误在对话中显示简短提示，技术原因脱敏写入私有 `model-errors.log`。创建示例允许空或与默认一致的尺寸覆盖；修改已有设计仍要求真实参数变化。

`desktop/cad/freecad/connector.mjs`通过FreeCADCmd探测用户目录并安装自有Mod组件，`freecad-addon/InitGui.py`在CAD启动后自动连接。主进程优先复用共享工作区，使用FreeCAD的single-instance启动入口、保留CAD用户配置；断连但旧进程仍活着时不再启动替代窗口。`freecad/bridge.py`在GUI线程每350ms轮询本地inbox，请求先消费再执行，12秒是启动期限。普通操作20秒、原生批次120秒未返回时锁住后续写入并等待迟到结果，不自动重试。源修订变化通过原窗口reload_bridge更新，保留文档令牌、工程、选择、相机；首次未加载组件的旧CAD需保存后重开一次，用户无需跑宏/Python。详见[连接说明](cad-connection.md)。

写入时重读活动文档、文档令牌、对象类型、草图、相关属性、Body BRep与选择并计算指纹；不匹配便拒绝。普通快照超过5秒未更新且无新执行进度视为断连。快照在确认结果前写入，避免连续任务读到旧上下文。复杂工程摘要性能仍需验证，不能称为完整CAD变更监控。

`desktop/freecad/features.py` 将配方生成为原生Body/Sketch/Pad/Pocket；参数更新保留对象名，在事务内重建，逐特征和Body核对单实体有效性。配方与稳定编辑签名保存在 `HarnessInfo`，签名不依赖重开可能变化的BRep字节顺序。发现手工编辑便拒绝配方覆盖，未实现自动合并。旧板仍用四个原生直径约束。撤销/重做作用于最近原生事务；保存仅另存新 `.FCStd`，打开保留其他工程。附件暂不解析，桌面与原型数据不自动迁移。

`native-catalog.json`由固定MIT上游AST生成，`cad/freecad/contracts.mjs`校验参数和单文档计划；`agent/tools.mjs`注册66项原生工具及批量计划工具。读取立即执行，写入只追加待确认JSON。`freecad/native_api.py`将已确认步骤交给`native_upstream`的本地handler，在目标文档范围和原生事务内执行，实际读回结果。新建标记置于首事务之外，使第一次撤销后仍能重做；几何/导入/导出分别检查。原生批次最长等待120秒，保留逐步进度；其他操作仍为20秒，12秒是请求启动期限。宏避免GUI更新引起重入。快照增加所有Shape、相关属性、可见性和参数表内容，原生工程标记为gouxing-native-v1；旧配方首次原生编辑明确转换模式。没有复制上游网络服务器或任意脚本执行器。

原生组件外形用不含显示网格的optimalBoundingBox测量，快照还提供已列出组件的整体envelope，避免把单翼长度当成总展。可见性与有限ViewObject显示属性可读取/确认修改；镜像保留源对象。边界和有效性仍不能替代装配与制造校核。

Electron [窗口接口](https://www.electronjs.org/docs/latest/api/browser-window)及[contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)用于原生行为与隔离；FreeCAD 选择读取参考[官方 API 源码文档](https://freecad.github.io/SourceDoc/d4/dca/classGui_1_1SelectionSingleton.html)。具体通过结论以本仓库测试结果为准。


应用层校验独立在 `desktop/application/plans.mjs`，Node 文件桥接在 `desktop/cad/freecad/bridge.mjs`。Session 直接使用 `shared/harness.mjs` 并显式传入桌面工作目录、提示词和稳定插件入口；网页由自身薄封装传入原有默认值。Electron 父进程下的只读真实模型回归见[验证记录](validation.md)。
