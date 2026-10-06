# Railplot · 列车谱

在浏览器中绘制和编辑列车运行图。适合 Rail Route 等铁路模拟游戏的线路规划与时刻编排，支持图形化建线、拖动调整时刻，以及 PNG、矢量 PDF 和 SVG 导出。

**[在线使用](https://railplot.xingrz.me)**

## 使用

1. 打开“编辑线路”，添加车站、连接主线与支线，拖动调整站位。
2. 添加列车并填写到发时刻。拖动运行线可平移整趟车，选中后的时间点可单独调整；拖动背景浏览运行图。
3. 用“保存工程”下载 `.railplot` 文件，下次通过“打开”继续编辑；用“导出图表”生成图片或矢量文档。

修改会保存在当前浏览器中，清除浏览器数据会丢失本地记录，请另存工程文件备份。`⌘/Ctrl+S` 保存，`⌘/Ctrl+Z` 撤销，`⌘/Ctrl+Shift+Z` 重做。

当前面向桌面浏览器，支持一条主线和三列平行支线。跨日时刻写作 `24:00`、`25:00`，单图时间窗口最长 24 小时。运行图用于编排和展示，不自动检查闭塞、进路、站台冲突或线路可达性。示例数据为虚构。

## 本地开发

需要 Node.js 22.12+（推荐 24）和 npm。

```sh
npm ci
npm run dev
```

打开终端显示的地址。项目使用 Vue 3、TypeScript 和 Vite，无需后端服务。

```sh
npm test             # 单元测试
npm run build        # 类型检查与构建，输出到 dist/
npm run preview      # 预览构建结果
npm run format:check # 格式检查
```

GitHub Actions 检查并构建所有分支和 Pull Request；仅 `master` 发布到 GitHub Pages。发布源选择 GitHub Actions，自定义域名为 `railplot.xingrz.me`。

更多信息：[架构与维护](docs/architecture.md) · [工程文件格式](docs/file-format.md)。

## 许可证

[MIT](LICENSE)。PDF 内嵌中文字体使用 SIL OFL 1.1，见[字体说明](public/fonts/README.md)。
