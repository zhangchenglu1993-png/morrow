# Morrow / 点滴美好

> Small joys, kept for tomorrow.<br />
> 把今天的美好，留给明天。

Morrow 是一个面向真实生活记录的积极内容社区。它不承载广告、新闻、政治、负面内容或 AI 生成内容，只保存成员自己经历的真实美好，并通过每日积极心理学练习、共同反馈和社区治理，让这些美好被看见和珍藏。

第一版是邀请发布、公开浏览的响应式 Web 应用。产品设计见 [设计文档](docs/superpowers/specs/2026-10-24-morrow-community-platform-design.md)，实施顺序见 [实施计划](docs/plans/2026-10-24-morrow-mvp-implementation.md)。

## 已实现

- 邀请码注册、邮箱验证、邮箱密码登录和 HttpOnly 会话。
- 公开广场、单列大图、今日精选、30 天每日问题。
- 文字、图片、视频发布，作者删除，私有媒体访问控制。
- 四表情单选互动：喜欢、开心、平静、难过。
- 长按反馈：AI 生成、虚假、违法或暴力、负面。
- 至少 10 人反馈后按 20% 负向比例自动永久隐藏。
- 文字/表情评论，评论到达 5 人反馈后隐藏。
- 浏览器 IndexedDB 私密草稿与私人记录，私密内容不发网络请求。
- 20 级秦制爵位、贡献事件、成长地图和公共爵位榜。
- 普通规则一人一票、重大方向加权投票、联署、讨论与可执行参数变更。
- 产品负责人邀请码管理页。
- 单元测试、SQLite 集成测试、响应式页面检查和生产构建。

## 本地运行

要求 Node.js 24 或更高版本。

```bash
npm install
npm run db:setup
npm run dev
```

`npm run db:setup` 会在首次运行时创建产品负责人账号、打印一次性密码，并生成一个 7 天有效的邀请码。登录后可在 `/admin/invites` 生成新邀请。

如需要演示数据和界面内容：

```bash
npm run db:demo
```

演示成员邮箱为 `demo1@morrow.local` 至 `demo11@morrow.local`，密码为 `MorrowDemo2026!`。演示数据只用于本地体验，不应放进生产环境。
演示成员邮箱为 `demo1@morrow.local` 至 `demo11@morrow.local`。脚本会打印本次生成的演示密码；也可通过 `MORROW_DEMO_PASSWORD` 指定。演示数据只用于本地体验，不应放进生产环境。

打开 <http://localhost:3000>。

## 环境变量

复制 `.env.example` 为 `.env.local` 或配置到部署环境。生产环境必须配置 `MORROW_APP_URL`、邮件发送服务和持久化数据目录。

开发环境未配置邮件服务时，注册响应会提供本地验证链接，服务端只打印邮件主题和收件地址，不打印私密内容。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

测试包括反馈隐藏边界、重复反馈去重、爵位阈值、投票权重、密码哈希和真实 SQLite 隐藏流程。

## 数据与隐私边界

- `data/` 不进入 Git，包含本地 SQLite 与上传文件。
- GitHub 只公开代码、文档、规则和技术讨论。
- 用户发布的文字、图片、视频、邮箱、评论、反馈和生产密钥永不进入仓库。
- 私密记录只存在浏览器 IndexedDB，不提供服务端备份或恢复。
- 公开页面禁止搜索引擎收录，但直接链接仍可能被手动转发。

## 当前第一版限制

- 尚未接入阿里云 OSS；当前媒体使用服务器本地持久磁盘，存储接口已隔离。
- 邮件使用 Resend API；未配置时仅在开发环境返回验证链接。
- 不做发布前违法内容识别，依赖发布后社区反馈。上线前必须完成运营主体所在地的合规确认。
- 不提供私密内容导出、同步、找回或心理危机干预。
- 治理提案中的任意文本会形成社区决定；只有白名单内的规则参数可由系统自动执行。

## 部署

见 [部署说明](deploy/README.md)。

## 开源治理

- 许可证：GNU AGPL v3.0。
- 贡献需通过 Developer Certificate of Origin（DCO）。
- 公开仓库欢迎 Issue 和 Pull Request。
- 主分支需要自动测试和至少 2 位维护者审核。
- 用户内容永不进入开源仓库。

详见 [GOVERNANCE.md](GOVERNANCE.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)。
