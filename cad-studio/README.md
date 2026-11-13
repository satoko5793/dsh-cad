# 构形 CAD 应用

项目文档已统一到根目录的 [`docs/`](../docs/README.md)，本文件保留为应用目录入口。

本目录是保留的网页与 CadQuery 验证原型。桌面开发版在 `desktop/`，完整工作台、悬浮小窗和有限 FreeCAD 操作见[交互规格](../docs/desktop-harness.md)。

- [安装、启动、使用与备份](../docs/usage.md)
- [代码结构、建模流程与数据约定](../docs/architecture.md)
- [测试、实测证据与能力限制](../docs/validation.md)
- [产品目标](../docs/product.md)与[下一阶段路线](../docs/roadmap.md)

网页原型在仓库根目录运行 `npm run start:web`，或双击根目录 `start-web.cmd`。地址为 `http://127.0.0.1:3090`；项目文件在本目录 `.data/`，删除或迁移程序前请备份。默认 `npm start` 已改为桌面应用。
