# FreeCAD 原生工程最小验证

2026-11-13在 Windows、FreeCAD 1.1.4（Python 3.11便携包）中实测。首个 CAD 验证对象已选定为 FreeCAD，当前采用内置 Python/宏验证，尚无常驻 Harness 适配器。

## 已验证

`probe.py` 创建80×40×5mm四孔板，原生对象为 Body、BaseSketch、BasePad、MountingHoles 和 ThroughHoles。孔草图有直径与中心位置约束，打孔为 PartDesign Pocket。

命令行模式24项检查通过；GUI宏模式在相同检查基础上加上活动文档和选中对象读取，共26项通过，二者包含重复检查，不计为50个独立用例。

- 检查尺寸、单实体有效性和四孔解析体积。
- 孔径6→8mm，执行事务撤销至6、重做至8。
- 保存原生 `.FCStd` 后关闭并重开，草图约束仍为8mm。
- 重开后修改至10mm，再撤销回8，证明特征可继续编辑。
- GUI中显示原生工程，脚本选择 ThroughHoles，读回活动文档及选择对象。通过桌面观察确认模型与特征树可见；手动点击补测受到用户输入打断，未声称已验证持续监听用户选择。

结果见 [命令行记录](results-headless.json)和[GUI记录](results-gui.json)。JSON中的文件路径是本机证据位置，不是仓库携带的原生工程。

## 本机环境与复现

完整缓存包 `E:\dsh\installers\FreeCAD-complete.7z` 与此前保存的SHA256一致：`4828741fc91ee37fafcdb97a1abacb18b04ba451ac4372d9ff7a7349b36f4d6d`。原来的不完整解压目录保留，完整包解压到独立测试运行时：`E:\dsh\runtime\freecad-test-1.1.4\`。

在仓库根目录运行（FreeCAD路径替换为实际位置）：

```powershell
$env:FC_NATIVE_OUTPUT = 'E:\dsh\freecad-native-validation-20261113'
& 'E:\dsh\runtime\freecad-test-1.1.4\FreeCAD_1.1.4-Windows-x86_64-py311\bin\FreeCADCmd.exe' research/freecad-native/probe.py
```

结果保存在输出目录的 `headless/`。默认输出为上述E盘路径，可用环境变量更改。脚本会重新生成专用测试文件，不要将该输出目录设为自己的工程目录。

GUI验证在独立用户配置下启动 FreeCAD，并执行调用同一脚本的 `.FCMacro`；结果在 `gui/`。本次配置及宏位于上述输出根目录，原生文件为 `gui/plate-6mm.FCStd` 与 `gui/plate-8mm.FCStd`。GUI保持最终8mm状态供查看，经历撤销后可能显示未保存标记，磁盘中的8mm文件已在测试中重开核验。

## 后续缺口

本次使用确定性脚本，没有通过大模型自主操作或连续的桌面会话；尚未验证用户选择事件监听、过期对象与文档切换保护、跨任务取消恢复、装配、制造和实物。下一步按[实施路线](../../docs/roadmap.md)将已验证操作接入 Harness，而非把宏测试当作桌面产品完成。

参考官方[Python脚本基础](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/FreeCAD_Scripting_Basics.md)、[Python控制台](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Python_console.md)和[启动配置](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Start_up_and_Configuration.md)。这些文档支持选择验证路径，具体通过结论以本次运行记录为准。
