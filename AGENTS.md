# Railplot 维护约定

## 项目与结构

Vue 3、TypeScript、Vite 的纯前端列车运行图编辑器，使用 MIT 许可证。界面、错误信息与文档使用简体中文，源码标识符使用英文；不引入后端、账户或联网存储作为基本使用前提。

- `src/model.ts`：工程类型、导入校验、时间计算及运行图坐标。
- `src/composables/useProjectState.ts`：草稿、有效快照、历史与浏览器存储。
- `src/networkEditing.ts`、`networkGrid.ts`、`routeGeometry.ts`：线路操作、网格坐标和分岔／汇合几何。
- `src/components/RailplotWorkspace.vue`：工作区、文件操作与快捷键。
- `src/components/Diagram.vue`、`RouteLayer.vue`：运行图交互及屏幕／导出共用的线路绘制。
- `src/components/NetworkGraph.vue`、`NetworkGrid.vue`：Vue Flow 图形编辑与辅助网格。
- `src/components/TrainEditor.vue`、`ProjectSettings.vue`：列车与图表表单。
- `src/theme.ts`、`style.css`：Naive UI 主题与界面样式；`src/export.ts`：文件和图表导出。

架构、交互边界与验证路径见 [docs/architecture.md](docs/architecture.md)，文件格式见 [docs/file-format.md](docs/file-format.md)。

## 实现约定

- 领域逻辑不依赖 Vue 或 UI 库。通用控件使用 Naive UI，图形编辑使用 Vue Flow 的公开 API，不重复实现现有库能力。
- 工程数据是唯一持久化来源；局部输入和拖动预览留在组件中，完成后提交一次历史。不要逐帧、逐字符保存。
- 保持代码可读：顶层声明、函数及不同职责之间留空行。配置文件也要格式化；Prettier 不能替代人工检查。
- 界面只保留支持实际操作的控件和说明，错误与必要反馈须清晰。文档只记录当前能力、设计理由及维护要求，不写聊天过程、修改流水账、本机路径或私人素材。

## 行为约束

- `.railplot` 使用版本化 JSON；未知输入必须在导入边界校验，失败不得覆盖工程。无效编辑保留最近有效图表，不写入本地有效记录。跨日使用显式 24+ 小时，不猜测次日。
- 停站水平线、折返、列车配色及主支线对齐须保持。缩放只改变时间轴，每分钟至少 12 像素；左侧线路、站位和字体不随横向缩放改变。导出包含完整时间窗口。
- 单击背景或再次点击选中车次取消选择；拖动背景只平移视口。运行线可整体平移，时间点可单独调整，均按分钟吸附并保持时序有效。松手提交一次可撤销修改，取消手势不提交。
- 线路拖动按可见网格吸附，辅助线随视口对齐；打开既有工程不得量化或重排站位。键盘移动与鼠标操作走同一领域逻辑。改名、移动保留列车引用，禁止删除仍被列车使用的车站。
- 屏幕与导出共用分岔／汇合几何。导出排除编辑控件和选择态；PDF 必须保留矢量路径及可检索中文，不得改用截图。

## 验证

交付前执行 `npm test`、`npm run build`、`npm run format:check`。构建包括 TypeScript 检查。

界面改动须在浏览器验证受影响的编辑、撤销、保存／重开和导出路径；视觉改动检查截图。PDF 改动还须检查矢量、中文提取及渲染。临时产物放入已忽略的 `output/`，不提交。区分本地检查、远程 CI 和线上实测，不能互相替代。

## 构建与发布

- 使用 npm 和已提交的 `package-lock.json`，CI 通过 `npm ci` 安装依赖，Node.js 使用 24。
- `.github/workflows/pages.yml` 对所有分支 push、Pull Request 和手动触发执行检查与构建；只有 `refs/heads/master` 的非 PR 运行可上传 Pages 产物并部署。其他分支不得获得部署权限。
- 构建目录为 `dist/`，Pages 发布源为 GitHub Actions，自定义域名在仓库 Pages 设置中配置为 `railplot.xingrz.me`。域名不依赖 `CNAME` 文件，部署不提交构建产物。
- 部署 job 依赖构建通过，并使用 `github-pages` environment；保留分支限制和部署串行执行。

## Git 与交付

提交使用 Conventional Commits，正文说明必要理由并按 75 字符硬换行。AI 辅助提交添加实际模型身份的 `Co-authored-by` trailer，不猜测模型细分版本。提交前核对 author 和 committer，其他维护者使用自己的身份。

保留原有空初始提交。按可审阅的逻辑组织改动；只整理本次未推送的提交，不覆盖他人修改或擅自重写已发布历史。提交、推送、部署按当次授权分别处理。保持 README 简洁、面向使用者，不把实现细节或验收清单写成产品介绍。
