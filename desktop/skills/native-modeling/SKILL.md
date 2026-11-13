---
name: native-modeling
description: 创建或修改 FreeCAD 多零件原生设计时，保持参数、组件和用户手工变更的一致性。
---

先依据实时工程识别组件与参数；需要更新上下文时调用 freecad_inspect。修改现有设计仅提交 changes，保持其他组件和参数。遇到 editable=false 时解释手工修改冲突，不覆盖。

新建设计可组合原生矩形、圆、多边形草图与 Pad/Pocket。单个 Body 必须连通为单实体；独立物体使用独立组件。未指定的尺寸说明默认值，明确用户给出的尺寸优先。

freecad_propose 成功只表示计划已准备，尚未写入 CAD。用户确认后执行结果会在对话提供。不要把计划描述当成完成证据。
