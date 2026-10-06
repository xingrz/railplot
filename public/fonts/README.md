# Railplot PDF 字体

`RailplotSans-Regular.ttf` 用于本地 PDF 矢量导出，来源为 Google Fonts 的 Noto Sans SC，采用 SIL Open Font License 1.1，完整授权见同目录 `OFL.txt`。应用源码的 MIT 协议不替代字体协议。

上游：https://github.com/google/fonts/tree/main/ofl/notosanssc

原始文件：`NotoSansSC[wght].ttf`。通过 fontTools `varLib.instancer` 将 `wght` 固定为 400，保留全部 Unicode 字形，不裁剪中文字符覆盖范围。静态实例另存为本文件以适配 PDF 字体嵌入。运行时无需安装 fontTools。

```sh
fonttools varLib.instancer 'NotoSansSC[wght].ttf' wght=400 --output RailplotSans-Regular.ttf
```

字体仅在首次导出 PDF 时从应用自身加载，不依赖外部字体服务。PDF 只嵌入实际使用的字形。
