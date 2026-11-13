# 桌面 CAD 助手

项目主应用：Electron 对话 Harness，完整工作台与悬浮小窗共享一个 Session，通过专业 CAD 的原生接口创建、观察和修改工程。目前接入 FreeCAD，SolidWorks / Fusion 尚未接入。

在仓库根目录运行 `npm start` 或双击 `start.cmd`。连接、配置和使用见[使用指南](../docs/usage.md)及[连接说明](../docs/cad-connection.md)。

## 源码分层

| 目录 | 职责与入口 |
|---|---|
| `shell/` | Electron 窗口、快捷键、IPC、原生文件对话框；`main.mjs` |
| `ui/`、`preload.cjs` | 对话、流式内容、工具卡片、设置及紧凑布局；隔离的固定 IPC 桥 |
| `application/` | 会话状态和任务生命周期；`session.mjs`、计划校验 `plans.mjs`、错误提示 `errors.mjs` |
| `agent/` | 工具注册、技能/工具配置、真实 DSH 增量事件；`tools.mjs`、`config.mjs`、`stream.mjs` |
| `domain/` | 不依赖运行环境的配方、参数规则、示例和精确指令 |
| `cad/freecad/` | Node 侧适配器：连接组件安装、文件桥接、原生接口契约 |
| `freecad/` | FreeCAD GUI 线程内的 Python 执行器、工程观察、事务与上游 handlers |
| `freecad-addon/` | 自动连接的用户 Mod 启动组件 |
| `infrastructure/` | 稳定路径、原子 JSON 文件写入 |
| `skills/`、`prompt.txt`、`native-catalog.json` | Agent 技能/参考、提示词、固定版本原生接口目录 |
| `test/`、`validation/` | 自动测试、显式集成测试及可公开的验证摘要 |

共享 DSH 传输和独立 Node 检测在 [`../shared/`](../shared/README.md)。桌面应用不导入 `cad-studio/`；新 CAD 适配器应放在 `cad/` 下，通过应用层接入，避免绑定窗口代码。

## 稳定入口与数据

根部 `main.mjs`、`session.mjs`、`bridge.mjs`、`plan-plugin.mjs` 等只保留兼容转发。新实现写入上表目录，避免再次形成两份代码。保留这些入口是为了兼容已有 DSH profile、脚本和工具导入。

已安装组件引用的 `freecad/`、`freecad-addon/`，以及提示词、技能、目录文件的路径保持稳定。`.data/` 存放用户对话、草稿、附件、能力设置和桥接工作区，属于私有数据；单一 CAD 的共享连接在 `.data/cad-workspace/`。目录整理不迁移用户数据，不自动转换网页原型项目。

开发命令、依赖约定和提交规则见[开发指南](../docs/development.md)，能力边界见[原生接口](../docs/native-interfaces.md)及[验证记录](../docs/validation.md)。
