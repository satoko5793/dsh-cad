# CAD skills 与 tools：优先复用的来源

检查日期：2026-11-13。按用户要求，新增 skill/tool 先查已有实现，检查源码、接口和验证，再决定复用或适配。下表来自实际下载的源码；不是只比较宣传页，也不把下载当作接入成功。

| 来源、固定版本 | 已检查内容 | 采用判断与当前状态 |
|---|---|---|
| [seansackowitz/mcp-freecad](https://github.com/seansackowitz/mcp-freecad/tree/685341437f26f2a62e0122cdb893d09ae30b5034) | `addon/FreeCADMCP/handlers`、`src/mcp_freecad/tools`、README、MIT LICENSE | v1.2.0实际采用10个handler文件的66项原生接口，覆盖草图、Part、PartDesign、表达式、参数表与交换文件；全部在FreeCAD 1.1.4执行。复制README和MIT通知，按源码AST生成DSH契约与技能references。本地加入计划/确认、事务、文档范围、兼容修正及显示属性。没有采用网络服务器或任意Python执行器。 |
| [ghbalf/freecad-ai](https://github.com/ghbalf/freecad-ai/tree/08d637d145dbc12397599aedafa93ada2dd35f92) | `skills/enclosure/SKILL.md`、`fastener-hole`、`create-validation`，以及 `freecad_ai/utils/viewport.py`、`LICENSE-CODE` | 现有外壳、标准孔等技能和独立验证规则值得优先采用。源码声明 LGPL-2.1；本次仅参考，未复制或装入运行时。技能调用 create_body/create_sketch/pad_sketch/pocket_sketch/execute_code 等接口，本应用还没有对应工具，不能直接导入后宣称可执行。 |
| [neka-nat/freecad-mcp](https://github.com/neka-nat/freecad-mcp/tree/5014bd9d538b8d09e11201e219cfe291ebca7b4e) | `docs/tools.md`、`src/freecad_mcp/server.py`、`addon/FreeCADMCP/rpc_server/view_manager.py`、`LICENSE` | 工程读取、显式截图、对象编辑的主要工具候选。MIT。已复用 `get_displayed_3d_view` 到本项目 `desktop/freecad/view_context.py`，保留版权、版本及完整许可证；实际 FreeCAD GUI 测试通过。没有安装整个 MCP server，也未开放 execute_code。 |
| [jablonkai/skills 的 FreeCAD skill](https://github.com/jablonkai/skills/tree/6350087b5511e50ef7998e2a75e5930da06687c2/skills/freecad) | `SKILL.md`、`scripts/freecad-bridge.py`、仓库 LICENSE | 已有“构建、检查、测量、截图、迭代”流程，以及截图前关闭视角动画、检查失效特征、保留用户工程等具体经验。技能声明 GPL-3.0-only。作为参考，未复制其技能/脚本进运行时。示例入口为 macOS/bash，桥接支持任意 Python，与本应用 Windows/确认计划接口不同。 |

下载位置为忽略提交的 `research/cad-tools/sources/{seansackowitz-mcp-freecad,freecad-ai,neka-freecad-mcp,jablonkai-skills}`；原始许可证留在各目录。运行时实际采用的MIT文件、上游版本/原始SHA256与适配清单见 [`SOURCE.json`](../../desktop/freecad/native_upstream/SOURCE.json)，完整MIT许可证随vendor和技能保留。上表版本不代表远端后续main/master。

## 已有工具到本应用的映射

| 本应用接口 | 优先参考的现成接口 | 仍需要适配的部分 |
|---|---|---|
| `freecad_inspect` | FreeCAD MCP 的 `get_objects/get_object` | 连接到明确实例，补充本项目文档令牌和修改指纹 |
| `freecad_capture` | FreeCAD MCP 的 `get_view`、显示中三维视图检查 | DSH image block、模型图像能力、保留原相机和本机预览 |
| 66项原生工具 + `freecad_native_plan` | MIT mcp-freecad的类型化handler与工具说明 | 真实读取与确认后写入分开；最多100步/单工程；FreeCAD版本修正见SOURCE记录；不是任意代码执行 |
| `freecad_propose` | 旧数据配方路径 | 保留参数更新和简单示例；复杂造型优先用上述原生工具 |
| `skill_read` | 按需SKILL.md与references | 已能读取声明清单中的Markdown/JSON；导入按钮仍只复制SKILL.md，不复制/执行外部脚本 |

`freecad-native`是围绕现成MIT工具与上游README的本地适配，其他三个内置SKILL.md仍是本地说明。没有将GPL/LGPL候选技能复制入运行时，也没有把涉及脚本或尚未接入工具的外部技能标记为可运行。新增技能仍先核对依赖工具与真实工程回归。

## 本次复用的验证

`desktop/test/view-context-check.mjs`曾在独立FreeCAD 1.1.4验证：模型标签在前台时接受三维视图；表格标签在前台时拒绝捕获后台模型。证据：[`view-context-results.json`](../../desktop/validation/view-context-results.json)。这是历史独立探针，复现需显式GOUXING_ALLOW_ISOLATED_CAD=1，避免日常测试再堆叠窗口；其他常规测试默认复用共享CAD。

上游函数的说明指出，文档的ActiveView可能仍指向后台三维视图。先识别当前显示标签，才能避免把“存在一个模型视口”误称为“Agent看到了当前软件画面”。

v1.2.0的原生接口验证见 [`native-interfaces-results.json`](../../desktop/validation/native-interfaces-results.json)，包括所有66项实际执行、失败回滚、跨文档拒绝、撤销重做和保存重开后编辑。IGES上游接口曾静默不创建对象，已依据FreeCAD自己的`Mod/Part/Init.py`注册改为Part.insert；不依赖“接口返回成功”推断几何存在。

完整模型能力、跨平台稳定性和任意MCP接入仍需单独验证。候选代码中的默认执行模式与权限不能代替本产品的用户确认。
