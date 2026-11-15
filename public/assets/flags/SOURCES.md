# 国旗资源来源与使用说明

本目录收录中国、美国、德国、日本、韩国、英国、法国和印度八国的真实国旗 SVG，下载自 Flagpedia 运营的 FlagCDN，保留原始图形与比例。核验日期：2026-11-15。

## 来源与许可

- 服务及资源路径：[FlagCDN](https://flagcdn.com/)、[Flagpedia API 文档](https://flagpedia.net/download/api)。SVG 路径格式为 `https://flagcdn.com/{ISO 3166-1 alpha-2 小写代码}.svg`。
- 图形来源：[Flagpedia 关于页面](https://flagpedia.net/about)说明，其国旗图形基于 Wikimedia Commons 的矢量文件维护。
- 使用许可：[Flagpedia 使用条款](https://flagpedia.net/terms)及关于页面明确说明，国旗图像属于公有领域（public domain），可免费用于商业及非商业用途，可随本项目打包发布。
- 署名要求：官方文档仅表示欢迎回链，并未强制要求署名。为保留来源记录，本项目在此注明来源为 Flagpedia / FlagCDN。
- 上述公有领域说明仅适用于国旗图像；未复制该站其他文字、美术、页面设计或代码。

## 文件清单

| 文件 | 国家 | 原始下载地址 |
| --- | --- | --- |
| `cn.svg` | 中国 | https://flagcdn.com/cn.svg |
| `us.svg` | 美国 | https://flagcdn.com/us.svg |
| `de.svg` | 德国 | https://flagcdn.com/de.svg |
| `jp.svg` | 日本 | https://flagcdn.com/jp.svg |
| `kr.svg` | 韩国 | https://flagcdn.com/kr.svg |
| `gb.svg` | 英国 | https://flagcdn.com/gb.svg |
| `fr.svg` | 法国 | https://flagcdn.com/fr.svg |
| `in.svg` | 印度 | https://flagcdn.com/in.svg |

## 文件核验

八个文件均通过 XML 解析，根元素为 SVG 命名空间下的 `svg`。已检查不含脚本、事件处理属性、外部图片或链接、`foreignObject`、DOCTYPE / ENTITY 声明。内部 `use` 元素仅引用文件内的图形定义。

国旗在网页中通过本地资源加载，无需在游戏运行时请求第三方 CDN。
