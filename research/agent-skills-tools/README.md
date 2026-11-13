# CAD skills 与 tools：优先复用的来源

检查日期：2026-11-13。按用户要求，新增 skill/tool 先查已有实现，检查源码、接口和验证，再决定复用或适配。下表来自实际下载的源码；不是只比较宣传页，也不把下载当作接入成功。

| 来源、固定版本 | 已检查内容 | 采用判断与当前状态 |
|---|---|---|
| [ghbalf/freecad-ai](https://github.com/ghbalf/freecad-ai/tree/08d637d145dbc12397599aedafa93ada2dd35f92) | `skills/enclosure/SKILL.md`、`fastener-hole`、`create-validation`，以及 `freecad_ai/utils/viewport.py`、`LICENSE-CODE` | 现有外壳、标准孔等技能和独立验证规则值得优先采用。源码声明 LGPL-2.1；本次仅参考，未复制或装入运行时。技能调用 create_body/create_sketch/pad_sketch/pocket_sketch/execute_code 等接口，本应用还没有对应工具，不能直接导入后宣称可执行。 |
| [neka-nat/freecad-mcp](https://github.com/neka-nat/freecad-mcp/tree/5014bd9d538b8d09e11201e219cfe291ebca7b4e) | `docs/tools.md`、`src/freecad_mcp/server.py`、`addon/FreeCADMCP/rpc_server/view_manager.py`、`LICENSE` | 工程读取、显式截图、对象编辑的主要工具候选。MIT。已复用 `get_displayed_3d_view` 到本项目 `desktop/freecad/view_context.py`，保留版权、版本及完整许可证；实际 FreeCAD GUI 测试通过。没有安装整个 MCP server，也未开放 execute_code。 |
| [jablonkai/skills 的 FreeCAD skill](https://github.com/jablonkai/skills/tree/6350087b5511e50ef7998e2a75e5930da06687c2/skills/freecad) | `SKILL.md`、`scripts/freecad-bridge.py`、仓库 LICENSE | 已有“构建、检查、测量、截图、迭代”流程，以及截图前关闭视角动画、检查失效特征、保留用户工程等具体经验。技能声明 GPL-3.0-only。作为参考，未复制其技能/脚本进运行时。示例入口为 macOS/bash，桥接支持任意 Python，与本应用 Windows/确认计划接口不同。 |

下载位置为忽略提交的 `research/cad-tools/sources/{freecad-ai,neka-freecad-mcp,jablonkai-skills}`；原始许可证留在各目录。上表是这次检查的版本，不代表后续默认使用远端 main/master 的最新内容。

## 已有工具到本应用的映射

| 本应用接口 | 优先参考的现成接口 | 仍需要适配的部分 |
|---|---|---|
| `freecad_inspect` | FreeCAD MCP 的 `get_objects/get_object` | 连接到明确实例，补充本项目文档令牌和修改指纹 |
| `freecad_capture` | FreeCAD MCP 的 `get_view`、显示中三维视图检查 | DSH image block、模型图像能力、保留原相机和本机预览 |
| `freecad_propose` | 上游 `edit_object` 以及 FreeCAD AI 的具体建模工具 | 当前仅支持数据配方/参数更新；接入额外原生操作前仍需保留计划确认、事务及结果校验 |
| `skill_read` | FreeCAD AI 的 `use_skill` 与按需 references | 当前仅加载 SKILL.md；尚未加载整套 references、handler.py 或上游工具注册 |

本项目已有的三个内置 SKILL.md 是本地接口适配说明，并非上述项目的原版技能。不能靠改个工具名字就把涉及圆角、放样、旋转、单面编辑的外部技能标成可运行。后续优先针对所需技能列出依赖工具，再接入已有工具实现和真实工程回归。

## 本次复用的验证

`desktop/test/view-context-check.mjs` 启动独立 FreeCAD 1.1.4 GUI：模型标签在前台时接受三维视图；表格标签在前台时拒绝捕获后台模型。证据：[`view-context-results.json`](../../desktop/validation/view-context-results.json)。

上游函数的说明指出，文档的 ActiveView 可能仍指向后台三维视图。先识别当前显示标签，才能避免把“存在一个模型视口”误称为“Agent 看到了当前软件画面”。复用不改变几何写入白名单。

完整模型能力、跨平台稳定性和任意MCP接入仍需单独验证。候选代码中的默认执行模式与权限不能代替本产品的用户确认。
