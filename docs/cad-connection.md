# 一次连接，持续在同一CAD里工作

更新：2026-11-13，v1.2.0。普通用户不需要运行宏、打开Python控制台、复制脚本或填写MCP地址。连接组件由助手管理。

## 用户流程

1. 已安装FreeCAD后，在助手里点“连接FreeCAD”。优先读取上次路径或发现常见安装位置，找不到时才选择FreeCAD.exe。
2. 助手自动准备用户级连接组件，然后通过FreeCAD自己的single-instance入口启动或连接。以后打开助手、切换会话或重新连接，都优先复用同一窗口。
3. 如果首次安装组件时FreeCAD已经打开，组件需在保存工程后重开CAD一次才能加载。界面说明这一点，不代替用户强关、不另开一个实例，也不要求用户手动跑宏。以后受支持的连接升级在原窗口完成。
4. 默认围绕当前相关工程继续修改。只有明确新工程/独立模型时才新建文档；增加零件、改尺寸、改外观都继续原工程。确认区显示实际修改步骤，失败也不能悄悄新建一份替代。

关闭助手保留CAD；CAD重开后，组件登记新连接，助手自动重新读取。原生工程、视角、选择和未保存内容不能因助手重连/升级而丢失。连接暂时没响应时提示检查原窗口，不通过反复启动进程“恢复”。

## 组件怎样安装

`desktop/cad-connector.mjs` 用安装包自带FreeCADCmd读取实际UserAppData路径，再安装本应用拥有的 `Mod/GouxingConnect/InitGui.py` 和配置。使用FreeCAD标准用户Mod启动机制，不修改CAD程序目录或系统权限。参考[官方工作台启动约定](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Workbench_creation.md)。同名组件不属于本应用时拒绝覆盖。

启动组件在GUI就绪后连接本地常驻桥接，无网络监听。普通启动保留FreeCAD原有用户设置，使用[官方single-instance参数](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Start_up_and_Configuration.md)。版本1.1.4的Windows实际用户目录已通过FreeCADCmd探测并验证，不猜测固定版本目录。

共享工作区记录在私有 `desktop/.data/cad-workspace/connection.json`；会话目录保留引用。源文件修订变化由bridgeRevision识别，reload_bridge停止旧定时器/观察器、加载本应用已知源码并复用文档令牌，模型没有任意脚本执行入口。真实重载验证保留进程、文档、选择、几何和相机。

当前仍是源码开发版，尚无独立桌面安装包。连接组件安装已自动化，不代表SolidWorks/Fusion也已接入。首次已打开但未安装组件的CAD，仍可能需要一次保存后的重开。

## Windows 文件占用与结果回传

桥接的 `bridge_io.py` 使用独立临时文件和原子替换；遇到 Windows 5/32/33 错误会短暂、有限重试，不修改文件 ACL。临时进度文件无法更新时保留警告，不让界面进度错误中止 CAD 事务，也不让收尾进度覆盖真实执行结果。

快照或结果写入失败时，桥接在内存中保留待回传结果，后续定时器只重新发布，不重跑已经消费的 CAD 请求；待回传完成前不启动下一条请求。长时间无法回传仍可能触发助手“状态待核对”，解除占用后可读回迟到结果。此队列不是跨 CAD 崩溃的恢复机制，不能据此承诺进程被强制关闭后也能完整恢复。

计划执行失败后要读取结果及前后工程状态，不能仅凭进度停止就推断“完全没做”或直接重试。失败的修改仍须重新准备并由用户确认。

## 开发与测试

日常原生/模型测试默认复用共享CAD，在独立测试工程和私有会话里验证，不能每次失败就再启动一批窗口。历史reopen/view-context独立探针默认不启动，只有明确设置GOUXING_ALLOW_ISOLATED_CAD=1才允许单独进程，并禁用其中的自动连接组件。普通npm test不打开CAD。

证据：[自动组件安装及单进程复用](../desktop/validation/connector-results.json)、[原窗口升级与多会话复用](../desktop/validation/lifecycle-results.json)。`desktop/test/connector-check.mjs`验证真实自动启动；`lifecycle-check.mjs`只复用指定现有连接，绝不启动CAD。系统多屏/快捷键和完整打包分发仍需继续验收。
