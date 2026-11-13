# 共享 Harness 运行时

只包含两个应用共同需要的运行代码，不包含建模、UI、项目文件、技能或 CAD 接口。

- `harness.mjs`：DSH 子进程、专用 profile、JSON-RPC 请求/通知和关闭。
- `node-runtime.mjs`：选择并探测独立 Node，清理 Electron 专用环境变量。

调用方必须显式传入绝对路径 `cwd`、`prompt`、`plugin`，可选传入 `profile`、`env`、`nodeExecutable`。缺少应用路径时在启动前报错，不回退到网页原型。DSH CLI 从仓库根部的依赖中解析。

桌面应用由 `desktop/application/session.mjs` 直接使用共享 Harness，工作目录为 `desktop/`；网页原型的 `cad-studio/harness.mjs` 是提供原有默认路径和 profile 的薄封装。`cad-studio/node-runtime.mjs` 兼容转发共享实现。共享代码不得导入两端的应用模块。

DSH 必须运行在独立 Node 中，不能用 Electron 的 `process.execPath` 或 run-as-node 模式。启动器通过 `GOUXING_NODE_EXE` 传递已核对的 Node，子进程不继承 `ELECTRON_RUN_AS_NODE`。历史 profile 包名和 Cordis 插件 ID 中的 `cad-studio` 是保留的内部标识，不代表依赖原型目录。

纯协议和路径检查包含在根目录 `npm test` 中；Electron → 独立 Node → 实际模型/工具的只读回归通过 `npm run test:runtime` 显式运行，详见[开发指南](../docs/development.md)。
