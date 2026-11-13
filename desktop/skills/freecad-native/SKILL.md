---
name: freecad-native
description: 通过已接入的现成 FreeCAD 原生接口创建和局部修改复杂造型：草图、放样、旋转、圆角、布尔、阵列、参数、导入导出。
---

本技能适配 seansackowitz/mcp-freecad（MIT，685341437f26f2a62e0122cdb893d09ae30b5034），详细方法与参数范例保留在 upstream 参考资料中，各组接口契约在 doc、obj、part、pd、sketch、expr、sheet、io、view 中按需读取。

1. 读取实际工程和需要修改的对象。明确新建工程时先doc_list核对已有名称，再调用doc_create给唯一英文name。默认继续当前相关工程；修改不调用doc_create，不用新建工程代替修改。
2. 用上游原生接口按步骤建模。较长的构造使用freecad_native_plan一次提交明确的[{method,args}]接口步骤，减少往返；也可逐个调用原生工具追加。写接口只加入同一个待确认计划；返回planned并不表示实际对象已创建。为新对象提供唯一英文label，例如FuselageSection1、Fuselage、WingLeft；后续计划用同一ID引用。中文显示名称可用obj_set_label。
3. 常见原生方法：sketch_create + sketch_add_polyline/circle，然后part_loft/part_revolve/part_extrude；PartDesign使用pd_create_body、sketch_*、pd_pad/pocket/revolution/fillet。part_*是独立特征，pd_*是Body内特征。布尔用part_fuse/cut/common。放样各截面方向/顶点顺序应一致。
4. 本应用修正的平面：xy局部(u,v)→世界(X,Y)，xz→(X,Z)，法向-Y；yz→(Y,Z)，法向+X。pos为世界XYZ，rotation可用[轴X,轴Y,轴Z,角度]。截面在不同位置通过pos明确定位。翼型截面可使用闭合折线，再以part_loft在根部、翼尖截面间放样；机身用不同半径/形状截面做平滑放样。用真实构造方法，不把平板尺寸拉长当成完整造型改善。
5. 保留用户已有零件。新增垂尾可以新增草图/放样或拉伸。改变已有Part放样截面时只编辑对应草图几何/约束，或重新绑定Sections；需删除旧几何的操作明确列在计划中。不把无关零件重建一遍。
6. 用户确认后获取真实接口返回值、obj_get_properties、doc_recompute、截图核对。先检查错误与几何，再比较尺寸和目标外观；isValid不能证明造型、装配或气动正确。需要继续修正时另提下一轮计划。

显示检查：快照对象的visible和obj_get_properties返回的view反映实际可见性。obj_set_property还支持有限视图属性：ViewObject.Visibility（布尔）、ShapeColor/LineColor（三个0..1数值）、Transparency（0..100整数）、DisplayMode（FreeCAD原生枚举，如Shaded或Flat Lines）。修改显示同样先准备确认计划；镜像副本应保留源零件显示，不能把隐藏误判成几何缺失。着色不能代替造型或几何修正。

明确限制：本地适配器不提供script_execute_python，不执行上游说明中的Python逃生接口或shell命令。doc_open/save/close/set_active不作为工具开放；原生文件打开/保存走应用按钮。其他66项接口已接入调度，但具体FreeCAD版本/几何条件可能失败；失败会中止并回滚工程事务，需根据实际错误修正，不能宣称已完成。文件导出单独计划、拒绝覆盖。外来工程仍只读。
