# 开发与维护

桌面 Harness 是产品主线，网页/CadQuery 是完整保留的原型。当前代码层次见[桌面目录](../desktop/README.md)；产品行为见[技术说明](architecture.md)，原型实现见[原型说明](prototype.md)。

## 从哪里改

| 需要调整 | 主要位置 |
|---|---|
| 完整窗口、小窗、快捷键、原生对话框、IPC | `desktop/shell/main.mjs`、`desktop/preload.cjs` |
| 自动滚动、对话排版、工具卡片、设置、紧凑布局 | `desktop/ui/` |
| 对话/草稿恢复、准备/确认/执行/取消状态 | `desktop/application/session.mjs` |
| 计划校验和用户可读的错误 | `desktop/application/plans.mjs`、`errors.mjs` |
| 工具注册、技能启停/导入、流式事件 | `desktop/agent/` |
| 旧配方参数、示例、精确本地指令 | `desktop/domain/` |
| Node 侧 FreeCAD 连接、桥接及参数契约 | `desktop/cad/freecad/` |
| CAD 内事务、特征、上下文、截图 | `desktop/freecad/` |
| 自动连接启动组件 | `desktop/freecad-addon/` |
| CAD 技能及现成上游参考 | `desktop/skills/`、`research/agent-skills-tools/` |
| DSH 进程、JSON-RPC、独立 Node 探测 | `shared/` |
| 原型聊天、组件预览、CadQuery 版本/导出 | `cad-studio/` |

`desktop/main.mjs` 等根部 `.mjs` 是稳定兼容入口，只转发，不放新业务。先前安装的组件和 profile 仍使用这些路径；`freecad/`、提示词、技能和目录文件也保留原位。共享运行时不导入应用，domain 不导入环境代码；桌面生产代码不依赖网页原型。测试 `desktop/test/layers.test.mjs` 检查这些边界和兼容导出。

Session 负责生命周期，shell 负责窗口和用户入口，agent 负责模型协议，FreeCAD 适配器负责操作协议，Python 执行器负责 CAD 内实际变化。不要把新的 CAD 软件实现写进窗口事件或直接复制整个 Session；先在 `desktop/cad/<软件>/` 建立适配边界，再按实际能力接入应用层。目前只有 FreeCAD 经过验证。

## 启动与测试

先按[使用指南](usage.md)安装 Node、依赖和所需 CAD。根目录命令：

```powershell
npm start                  # 桌面主应用
npm run test:desktop       # 桌面及共享运行时的普通测试
npm run test:prototype     # 网页/CadQuery 原型测试，需要其 Python 环境
npm test                   # 两组普通测试；自动发现 *.test.mjs
npm run test:shell         # 隐藏测试窗口加载实际桌面入口/IPC/UI，无模型或 CAD 操作
npm run test:stream-live   # 显式真实模型 + 实际入口/renderer流式测试，只允许技能/工程读取
npm run start:web          # 保留的网页原型
```

普通测试不调用真实模型、不启动 CAD。`npm run status` 检查的是旧网页原型服务，不是桌面连接健康。

桥接文件占用回归使用 Python 标准库，默认解释器为原型虚拟环境，可用 `CAD_PYTHON` 指定；`desktop/test/bridge-io-check.py` 在独立临时目录复现 Windows 句柄占用及发布失败，不访问用户工程。显式 `node desktop/test/bridge-io-live.mjs` 仅复用已有连接，在原进程升级桥接并只读核对，不启动 CAD、不改变模型或视角。文件占用边界见[连接说明](cad-connection.md)。

修改共享 Harness、Node 选择或 Electron 启动链路时，还需显式运行：

```powershell
# 使用本机已配置的 DSH_HOME、CAD_LLM_PROVIDER / CAD_LLM_MODEL 路由
npm run test:runtime
```

该回归从独立测试 Electron 进程调用真实 DSH 和工具，会产生模型费用；只允许 `skill_read`、`freecad_inspect`，不创建窗口、不启动 CAD、不提案或写入模型。私有记录保存在 `desktop/.data/runtime-layer/`，公开摘要在 `desktop/validation/runtime-layer-results.json`。需要有效模型配置；普通 Node 测试不能代替这项 Electron 验证。

界面夹具是 `desktop/test/renderer-check.mjs`，需用 Electron 执行并清除 `ELECTRON_RUN_AS_NODE`；默认隐藏测试窗口，不调用模型、不操作 CAD。它复现思考 summary 按下→流式更新→点击、120次增量中的文字选择、空正文提示和生成配置保存。`test:stream-live` 则在隐藏的实际桌面入口中请求真实模型，只允许 `skill_read` 和 `freecad_inspect`，验证正文在结束前出现及思考面板稳定；会产生模型用量。原生接口、复杂模型、保存重开等集成入口和环境条件见[原生接口](native-interfaces.md)及[验证记录](validation.md)。这些测试必须显式选择，不能加入每次更新的默认命令。

保持用户正在使用的 CAD 和工程。日常集成测试复用共享工作区；独立 CAD 探针必须遵守现有隔离开关。不能为了验证而反复启动 CAD、创建新工程、改变用户视角或丢弃未保存内容。

## 数据与兼容性

`desktop/.data/` 和 `cad-studio/.data/` 各自保存私有数据，不自动互转。DSH 凭据由 DSH 管理，不复制到代码、UI、测试或公开文档。保存、备份和恢复见[使用指南](usage.md)。

代码更新不会使已经运行的 Electron 自动加载新模块；下次正常重开助手才生效。不要强制关闭 CAD，退出助手也不能结束 CAD。桥接升级由连接组件在原进程内处理；首次连接未加载组件的旧 CAD 需按提示保存后重开一次，见[连接说明](cad-connection.md)。

外部技能/工具优先检索现成实现，记录固定版本、许可、所需接口和实际兼容结果。`native_upstream` 的 MIT 声明、固定版本与适配说明必须保留；研究材料不是未验证能力的证明。

## 文档、提交与公开示例

需求改动更新产品/路线，行为改动更新使用/技术说明，验证完成后再更新验证记录。历史测试摘要保留其当时范围，不用新的通过数量覆盖旧实验结果。纯文档修改检查命令、链接、路径与事实即可。

```powershell
npm run repo:update -- "说明本次修改"
# 明确需要更新公开原型示例时：
npm run repo:update -- --export-samples "更新已选公开示例"
```

更新脚本检查 origin 和 main、获取远端并要求远端已被合入，自动发现并运行两组普通测试，检查暂存目录/文件大小及凭据特征，再提交、推送并核对远端提交。默认不重建或导出网页示例；`--export-samples` 才执行已有导出和复杂示例复查。脚本会暂存开发目录中的改动，包括已有暂存内容，运行前应审阅差异；不会强推。

只公开 `samples/projects.json` 中明确选中的四个示例。私人飞机、后续修改和涡轮工程不在清单内，不能随代码整理上传。禁止发布 `.data/`、虚拟环境、依赖缓存、凭据及用户模型。手动提交也要检查暂存文件和密钥特征，推送后核对远端 hash。
