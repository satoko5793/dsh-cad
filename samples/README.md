# 示例模型与实测结果

返回[文档中心](../docs/README.md)。完整能力状态和多模块本机测试汇总见[验证记录](../docs/validation.md)，加工与组装的下一阶段目标见[实施路线](../docs/roadmap.md)。本目录保留已选择的公开资产及原始证据。

这些模型通过本应用的 DeepSeek Harness 对话生成，保留了参数、建模脚本、聊天与版本。单位为 mm。导出目录只包含明确选中的四个示例，不包括全部本地项目。

| 模型 | 最新外形 | 主要特征 | 最新 STEP |
|---|---|---|---|
| 四孔安装板 | 80×40×10 | 四个 Ø8 通孔，保留 4 个历史版本 | [下载](projects/four-hole-plate/revisions/1794496041787-06d0b0f2/model.step) |
| 带筋电机支架 | 100×70×78 | 电机轴孔、4 个安装孔、4 个长圆槽、2 条三角加强筋 | [下载](projects/ribbed-bracket/revisions/1794499705670-9a8314e1/model.step) |
| 带柱散热外壳 | 120×80×36 | 开口内腔、4 个带盲孔安装柱、连接筋、接口孔、8 条散热槽 | [下载](projects/vented-enclosure/revisions/1794499584602-90772a2f/model.step) |
| 键槽法兰轴套 | 100×100×53 | 两级轴套、中心轴孔、贯穿键槽、6 孔圆周阵列、环形槽 | [下载](projects/keyed-flange/revisions/1794499626785-343468ac/model.step) |

每个 STEP 同目录均有 STL、`model.py`、`parameters.json` 和版本测量数据。建模脚本由应用的 CAD worker 注入 `params` 执行；在工作台导入示例后可以继续对话或修改参数。

网页实测预览：[电机支架](previews/ribbed-bracket.jpg)、[散热外壳](previews/vented-enclosure.jpg)、[法兰轴套](previews/keyed-flange.jpg)。

在根目录运行 `npm run samples:import`，即可把这四个示例加入工作台；已有同 ID 的本地项目会保留，不会覆盖。

## 实际验证

2026-11-13（北京时间）进行了三种复杂零件的生成测试。最终三种模型均为有效单实体，STEP 可重新导入，STL 文件结构正确。84 项检查全部通过，覆盖尺寸、孔槽的空腔、材料保留和筋的位置。

支架第一版虽然通过实体有效性检查，但两条加强筋缺失。对话修正后生成 V2，两个筋位置的实体检查通过；V1 作为失败特征案例保留，默认打开 V2。这说明“有效实体”不等于“完全符合需求”。

外壳高度从 36 改到 42 的参数预览成功，外形变为 120×80×42，仍为单实体；预览随后取消，没有增加保存版本。此次也修正了网页自动取景，避免较高零件被裁切。

- [原始生成需求与最终结果](generation-results.json)
- [84 项独立检查明细](verification-results.json)
- [外壳尺寸预览测量](enclosure-preview.json)
- 重新验证：`cad-studio\.venv\Scripts\python.exe samples\verify-complex.py`

检查采用 STEP 重新导入、外形测量和关键位置的材料/空腔采样，不是完整的尺寸公差或制造检验。没有进行强度、装配或散热性能验证。
