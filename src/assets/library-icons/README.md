# Plugin and model file icons

Offline SVGs from the exact Iconify identifiers requested for the library UI:

| File | Iconify identifier | Upstream license |
| --- | --- | --- |
| fluent-javascript.svg | fluent:document-javascript-16-regular | Microsoft Fluent UI System Icons, MIT |
| fluent-python.svg | fluent:document-py-16-regular | Microsoft Fluent UI System Icons, MIT |
| comfyui.svg | thesvg:comfyui | theSVG, MIT |
| langgraph.svg | simple-icons:langgraph | Simple Icons, CC0-1.0 |

Source URLs are `https://api.iconify.design/<prefix>/<name>.svg`. The corresponding *-info.json files preserve official Iconify collection metadata and upstream URLs; license texts are retained beside them. Brand names and marks remain owned by their respective owners.

src/ui/libraryIconPaths.ts contains the same viewBox/path data for static inline SVG rendering through LibraryAssetIcon. Use currentColor, keep original viewBox/fill-rule, and never fetch icons at application runtime. Library roots/folders and Function Flow use the existing lucide-react dependency.

`lucide-file-search-corner.svg` is the Lucide upstream icon from https://github.com/lucide-icons/lucide/blob/main/icons/file-search-corner.svg (ISC; LUCIDE-LICENSE). ToolIcon inlines its original paths because the installed dependency version does not export this icon.
