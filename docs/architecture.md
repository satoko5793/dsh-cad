# 技术说明与维护约定

本应用保持单人、本机架构：原生 HTML/CSS/JavaScript 与 Three.js 前端，Node.js HTTP 服务，DeepSeek Harness Agent，以及 CadQuery 2.8 / OpenCascade 建模进程。

## 代码入口

| 文件或目录 | 作用 |
|---|---|
| [`scripts/start-cad.mjs`](../scripts/start-cad.mjs) | 检查现有服务、启动应用、可选打开浏览器 |
| [`cad-studio/public/`](../cad-studio/public/) | 聊天、STL预览、模块列表、参数与版本界面 |
| [`cad-studio/server.mjs`](../cad-studio/server.mjs) | 项目API、任务状态、SSE事件流与下载 |
| [`cad-studio/harness.mjs`](../cad-studio/harness.mjs) | DSH子进程、JSON-RPC、路由与会话请求 |
| [`cad-studio/prompt.txt`](../cad-studio/prompt.txt) | 需求理解、口语修改、参数化和回复约定 |
| [`cad-studio/cad-plugin.mjs`](../cad-studio/cad-plugin.mjs) | 注册唯一建模工具 `cad_build`，限制Agent工具范围 |
| [`cad-studio/build.mjs`](../cad-studio/build.mjs) | Python worker、参数验证、预览和版本提交 |
| [`cad-studio/runner.py`](../cad-studio/runner.py) | 脚本检查、实体构建、测量和STEP/STL输出 |
| [`cad-studio/public/parameters.js`](../cad-studio/public/parameters.js) | 前后端共用的参数名称、单位与验证规则 |

## 两条建模路径

对话路径：浏览器提交需求与选中版本 → 服务端补充项目ID、选中脚本/参数和必要的最近对话 → DSH通过 `cad_build` 生成或修改 → worker验证并导出 → 保存新版本 → SSE通知前端。模型服务在首次对话时启动，密钥由DSH管理。

参数路径：使用已有脚本与新参数运行worker → 生成独立预览 → 用户取消或提交。此路径不需要大模型；提交复用已检查的预览文件，同一预览重复保存不会重复创建版本。

每个项目通过忙碌状态防止并发修改；任务与DSH会话映射保存在进程内。服务重启后任务不会恢复执行，持久化的聊天与版本仍在，新对话会补入选中版本和最近上下文。

## 脚本与模块约定

可编辑尺寸放在数值字典 `params`，配套规格可给中文标签、单位、步长和实际约束。长度为mm，角度为°，数量为整数。工具参数是修改的权威来源，worker会移除脚本顶层重复声明的字面量 `params`。

单体脚本将最终 `cq.Workplane` 或 `cq.Shape` 赋给 `result`。多模块脚本可声明 `components={'底座':base,'滑台':carriage}`，字典包含1至24个命名模块，每个值是非空有效的CAD对象。`components` 存在时成为最终导出来源，组成Compound，不自动融合；每个模块可以包含多个实体。

`geometry` 包含总体尺寸、世界坐标边界、体积、表面积、面数、实体数和圆柱面测量。`geometry.components` 保存各模块名称、尺寸、边界、体积与实体数；旧单体脚本返回空模块列表。名称帮助对话定位，尚不是带连接约束的装配数据模型，也不承诺在STEP中保留独立命名装配树。

下载的Python源码包含参数和导出语句，多模块时按 `components` 重新组合，保持与worker导出来源一致。

## 数据与版本

默认目录为 `cad-studio/.data/<项目ID>/`，可用 `CAD_DATA_DIR` 切换到独立数据目录。

| 位置 | 内容 |
|---|---|
| `project.json` | 聊天、版本索引、当前版本及项目时间 |
| `revisions/<版本ID>/` | `revision.json`、`model.py`、`parameters.json`、STEP和STL |
| `previews/<预览ID>/` | 临时模型、预览元数据及原始版本关系 |

项目JSON通过临时文件和重命名写入；它不是数据库事务系统。版本成功后追加，预览不直接修改原版本，30分钟后过期；过期并不代表文件已被后台自动清理。备份与迁移说明见[使用指南](usage.md)。

## 运行边界

服务固定监听 `127.0.0.1`，端口默认3090，可通过 `PORT` 指定。前端依赖由本地提供。模型路由与DSH配置见[使用指南](usage.md)。`CAD_PYTHON` 可覆盖worker解释器位置；当前健康检查及根目录启动依赖检查仍按默认 `.venv` 布局判断，不能仅凭自定义解释器就假设这些检查全部兼容。根目录启动器仍按默认3090探测和打开页面。

worker使用 `-I -X utf8`，保持Python隔离模式并明确管道编码。脚本有AST限制、有限内建函数、参数和几何检查、90秒超时；这些不构成操作系统级沙箱。保持本机单用户使用，后续若改变部署范围需要重新设计执行隔离与访问控制。

应用运行时检查实体有效性、非空实体、正体积及有限尺寸；不自动检查需求完整性、模块相交、连接配合、强度或制造工艺。独立验证脚本的结果不能当成所有新项目的自动检查能力。

## 测试、提交与公开示例

根目录 `npm test` 执行 `cad-studio/test/`；`npm run status` 仅检查服务。验证范围与证据见[验证记录](validation.md)。

涉及程序行为的常规更新可运行：

```powershell
npm run repo:update -- "说明这次修改"
```

脚本检查远端是否可安全快进，运行应用测试，导出已选示例，复查复杂模型，检查暂存文件后提交并推送。它不会强制推送。只导出 `samples/projects.json` 明确选中的4个项目，新项目需明确选择才能公开。

纯文档更新可直接检查链接、命令、差异与暂存文件后提交推送，无需使用会重新运行建模检查的完整更新命令。发布内容不包括 `.data/`、虚拟环境、依赖、密钥和完整私人目录。文档中心也在更新脚本的暂存目录范围内。

调研材料保留在 `research/`，示例资产保留在 `samples/`，已有配置引用的安装目录不随文档整理迁移。
