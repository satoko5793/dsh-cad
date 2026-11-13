# 构形 CAD

**用简单的话，在专业 CAD 中把想法做出来，并逐步推进加工和组装。**

构形是桌面 CAD 助手：完整对话 Harness 可以缩成悬浮小窗，用户一边使用 CAD，一边让 Agent 读取工程、观察视口、创建零件和继续修改。两种形态共享对话、草稿、连接和任务状态。

目前接入 **FreeCAD 1.1.4**，已有流式文字/模型提供的思考、工具记录、技能配置、视觉观察和确认后执行的原生建模流程。采用现成 MIT 实现接入 66 项类型化 CAD 接口，覆盖草图、放样、旋转、扫掠、布尔、圆角、阵列、参数表及交换文件；连续飞机建模与同工程修改已有实测。来源和边界见[原生接口](docs/native-interfaces.md)，证据见[验证记录](docs/validation.md)。

SolidWorks / Fusion 是后续适配方向，目前尚未接入。当前是开发版，尚无独立安装包；复杂造型的成功率、自由曲面、外来工程编辑和人机协作仍需继续完善，实际加工和组装尚未验证。

## 使用

先按[使用指南](docs/usage.md)配置 Node、依赖与模型服务，然后在仓库根目录运行：

```powershell
npm start
```

也可双击 `start.cmd`。点击“连接 FreeCAD”，助手自动配置组件并复用同一个 CAD；找不到安装位置时选择 `FreeCAD.exe`。新用户不用运行宏或 Python，已有旧 CAD 的首次连接例外见[连接说明](docs/cad-connection.md)。

可以说“我想做一个飞机模型”，检查计划后确认，再继续说“给它加两个涡轮”或指明某个零件的修改。具体效果取决于模型和几何条件，执行后需要查看结果。右上角切换小窗，`Ctrl+Alt+Space` 呼出/收起，`Ctrl+Alt+M` 切换形态。工具、技能和看图能力见[Agent 配置](docs/agent-tools.md)。

## 项目结构

| 位置 | 用途 |
|---|---|
| [`desktop/`](desktop/README.md) | 主应用：窗口/UI、会话、Agent、规则、CAD 适配器和 Python 执行器分层 |
| [`shared/`](shared/README.md) | 两端共用的 DSH 进程、JSON-RPC 和独立 Node 运行时 |
| [`cad-studio/`](cad-studio/README.md) | 保留原有网页 + CadQuery 思路、实现、预览和版本管理 |
| [`docs/`](docs/README.md) | 产品、使用、架构、开发和验收文档 |
| `scripts/` | 安装、启动、测试、示例和仓库维护 |
| [`samples/`](samples/README.md)、[`research/`](research/README.md) | 明确选中的公开示例、上游来源与研究证据 |

桌面端不依赖原型实现；稳定入口和已安装组件路径继续保留。用户对话、附件、工程及桥接数据仍在各自 `.data/` 中，不提交到仓库。

## 开发与原型

```powershell
npm test                  # 桌面 + 网页原型的普通测试
npm run test:desktop      # 桌面/共享模块
npm run test:prototype    # 原型，需要 CadQuery Python 环境
npm run start:web         # 原来的网页原型，127.0.0.1:3090
```

原型继续支持“对话 → CadQuery → 组件预览/版本修改 → STEP/STL”，四个已选示例可用 `npm run samples:import` 导入，详见[保留的原型说明](docs/prototype.md)。桌面与原型数据不自动互转。

完整导航见[文档中心](docs/README.md)，开发入口与提交方法见[开发指南](docs/development.md)，产品目标与下一步见[产品文档](docs/product.md)和[实施路线](docs/roadmap.md)。
