# Workflow type icons

Offline SVG assets obtained from the Iconify API, identified by their original icon sets:

- String: https://api.iconify.design/codicon/symbol-string.svg (Microsoft Codicons)
- Number: https://api.iconify.design/ix/data-type-integer.svg (Siemens Industrial Experience)
- Boolean: https://api.iconify.design/at-icons/boolean.svg (AT Icons)

Other workflow icons use the existing lucide-react dependency. These assets are used as CSS masks so the current theme controls their foreground color.

Current workflow icons use official Lucide SVGs: letters.svg, scan-box.svg, file-code-corner.svg and square-sparkles.svg from https://github.com/lucide-icons/lucide/tree/main/icons. See LUCIDE-LICENSE (ISC). Earlier Iconify assets remain for compatibility; current rendering uses the latest Lucide mapping.


2026-10-09 图标渲染修正：Letters、ScanBox、FileCodeCorner、SquareSparkles 的官方 Lucide 路径通过 createLucideIcon 生成内联 SVG，与内置 Binary 等图标使用相同渲染机制。移除带背景的 span/CSS mask；节点库仅文字 span 扩展，SVG 固定尺寸且不收缩，描边使用 currentColor，避免黑色矩形和 WebView 外部遮罩兼容问题。SD 列表、模型导航、节点库、画布与变量类型菜单共用这些组件。
