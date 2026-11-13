# CAD 方案调研

这是参考资料区，不是日常启动应用的入口。先了解各方案的思路，暂不继续安装或扩展。

返回[文档中心](../docs/README.md)。当前产品方向见[产品目标](../docs/product.md)，近期优先级见[实施路线](../docs/roadmap.md)；下文保留历史调研及证据。

GitHub 仓库包含调研说明、验证脚本和测试输出；`sources/`、`runtime/` 与本机插件安装包不发布。重新运行探针前需按下表来源取得对应版本。现有网页原型不依赖这些第三方项目的检出目录。

## 我们看过哪些方案

| 方案 | 主要方向 | 当前验证到哪一步 | 最值得学习 |
|---|---|---|---|
| [dsh-cad](https://github.com/LAU-MARS/dsh-cad) | DSH 内逐步建模和预览 | CAD 面板已加载；35 项相关测试通过；四孔板与尺寸修改、STEP/STL 导出通过；界面对话测试未完成 | 把拉伸、布尔、圆角等做成明确工具，并实时显示进度 |
| [CADStudio](https://github.com/ghadinehme/CADStudio) | 网页 CAD 与可编辑特征树 | 网页启动、特征编辑、尺寸修改、撤销/重做、代码与特征树往返、STEP/STL 导出通过 | 特征树、编辑预览、确认与取消 |
| [Chamfer AI](https://github.com/ashishexee/chamfer-ai) | 对话生成 CadQuery 的独立网页 | 独立 CAD worker 生成两版模型、STEP/STL/GLB、PNG 和尺寸视图；完整网页缺 Web3Auth 配置白屏，生成 API 缺 Docker | 几何检查、多视角验证、错误分类和修复流程 |
| [SOMA](https://github.com/Kai-Jungsthoefel/SOMA) | Agent 驱动的桌面 CAD | Python 核心构建安装板成功，识别五个参数；桌面依赖安装因下载 Git 组件时连接重置而失败，界面未测 | 参数的名称、单位、范围与默认值分开定义 |
| [Zoo](https://zoo.dev/) | 商业对话式 CAD 产品 | 在线工作台需登录；按用户选择只评估公开介绍和文档，未注册、未实测生成 | 对话、草图、代码、特征树之间的联动 |
| [FreeCAD MCP Bridge](https://github.com/CREATeNG/freecad-mcp-bridge) | AI 连接现有 FreeCAD 会话 | 已下载源码和 FreeCAD 便携包；未完成软件与桥接测试 | 把已有专业 CAD 能力开放给 Agent |

上表明确区分运行验证与文档了解。没有完整试用的方案，不作稳定性或建模成功率排名。

## 对我们项目最有用的结论

保持现有 **独立网页 + DSH + CadQuery** 的简单结构。以下是调研时提炼的借鉴方向，不表示这些项目代码已集成，也不替代当前实施路线：

1. **参数更清楚**：像 SOMA 一样显示参数名、单位和合理范围。
2. **修改更直观**：像 CADStudio 一样支持预览后确认、取消，并逐步增加特征树。
3. **结果更可信**：像 Chamfer AI 一样补充多视角和尺寸检查，让模型根据实测结果说明设计。
4. **工具更明确**：参考 dsh-cad，将常见机械操作封装成易检查的工具。

参数说明和预览确认已在原型落地，专业 CAD 原生特征编辑尚未验证。当前优先确定首个 CAD 并跑通原生操作，再做桌面 Harness 与悬浮小窗，后续推进控制盒制作闭环。不因本清单继续扩展外部试用，历史调研不证明 SolidWorks 或 Fusion 已接入。

## 资料位置

- `cad-tools/sources/`：下载的第三方源码，保留其原始许可证。
- `cad-tools/runtime/`：试用用的软件安装包和便携运行时。
- `cad-tools/evidence/`：测试输出、模型和导出文件。
- `cad-tools/probe-*.py`、`probe-*.mjs`：本地验证脚本。

关键证据：[CADStudio 测试结果](cad-tools/evidence/cadstudio/results.json)、[dsh-cad 建模结果](cad-tools/evidence/dsh-cad/results.json)、[dsh-cad 测试报告](cad-tools/evidence/dsh-tests.json)、[Chamfer API 依赖限制](cad-tools/evidence/chamfer-api-result.json)。

## 已保留的源码版本

| 项目 | Git commit |
|---|---|
| dsh-cad | `63d3bcab30d913ac8195600c4688dea1a9f3e4c3` |
| CADStudio | `aff42b2cb0d74a055421b056736d7336e338ac77` |
| Chamfer AI | `d08116c804b22a8d1442549790ee0a5dfa7a6b39` |
| SOMA | `7f5001d396e108d62f4c50c327bafec7c163c82d` |
| FreeCAD MCP Bridge | `63af24e1ea334df43ec2ac137f3d5dc0697f7ca0` |

调研时建立的临时服务使用 3101–3104 端口，整理时停止。现有网页原型使用 3090，原版 DSH 使用 3080；这不是未来桌面产品的启动约定。
