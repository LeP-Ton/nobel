# 会话-47：发布GitHub与Pages

## 背景与目标

- 用户要求提交项目、发布到GitHub，同时部署GitHub Pages。
- 起始分支main、提交b1d28a5，与上轮一致，工作区干净；此前没有持久Git远程。
- 已验证本机gh登录LeP-Ton；创建公开仓库`LeP-Ton/nobel`，保留现有Git历史。

## 修改与决策

- `.github/workflows/pages.yml`：main推送或手动触发后，使用Node.js 24安装锁定依赖、运行现有测试、类型检查与生产构建，再部署Pages；仅部署任务具备Pages写入及身份令牌权限。
- `src/App.tsx`：动态国旗路径使用Vite的BASE_URL，兼容`/nobel/`子路径。
- CSS中的公共图片由Vite按构建base自动重写，普通本地与Sites构建仍使用根路径。
- `README.md`：记录仓库、在线地址、部署与存档迁移方法。
- `AGENTS.md`：补充两种部署方式与长期资源路径约束。
- 不改变游戏数据、存档结构或科研规则；不引入额外测试框架。

## 验证与进展

- [x] 发布文件与历史敏感信息检查：47个跟踪文件及101个历史文件版本未发现凭据、私有存档、缓存或构建产物
- [x] 现有测试、默认路径构建、Pages子路径构建：20/20测试通过，两种构建均通过
- [x] 子路径资源与浏览器加载验证：本地5187/nobel/页面加载正常，八国国旗均从/nobel/assets/flags/成功加载，控制台无警告和错误；生产CSS中的四处背景图片均已自动重写
- [x] 提交、推送及GitHub Pages工作流成功：应用发布提交`6cd4c1a`，远程origin指向`https://github.com/LeP-Ton/nobel.git`并跟踪origin/main
- [x] Pages线上HTTP与界面验证：HTML、JS、CSS、八国SVG和科研背景均返回200；浏览器正式主页显示正常，截图见项目同级`outputs/nobel-github-pages.jpg`

## 发布结果

- 公开代码仓库：[LeP-Ton/nobel](https://github.com/LeP-Ton/nobel)
- 正式游戏：[GitHub Pages](https://lep-ton.github.io/nobel/)，已启用HTTPS
- 首轮自动测试、构建和部署：[Actions运行43719433216](https://github.com/LeP-Ton/nobel/actions/runs/43719433216)，全部成功
- 本地开发5186端口继续运行；仅关闭本次用于正式构建验证的5187预览。
- 最后的验证记录使用纯文档提交并跳过重复CI，不改变已发布应用产物。

## 风险与后续

- Pages是公开静态页面，代码仓库按本次发布目标公开。
- 新域名与原Sites的localStorage互不共享，既有JSON导入导出可迁移进度。
- 工作流使用官方Actions的固定提交；更新版本时应同时核对权限和运行时。
- 本轮未执行跨浏览器完整游玩回归；验证覆盖20项现有测试、两种构建、子路径图片、线上主页和资源可达性。
