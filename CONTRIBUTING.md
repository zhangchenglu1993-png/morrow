# Contributing to Morrow

感谢你愿意帮助守护这个项目。Morrow 的代码开放协作，但用户内容与生产数据永不进入公开仓库。

## 开始之前

- 阅读 [产品设计](docs/superpowers/specs/2026-10-24-morrow-community-platform-design.md)、[GOVERNANCE.md](GOVERNANCE.md) 和 [SECURITY.md](SECURITY.md)。
- 不要提交真实用户数据、邮箱、私密记录、生产密钥、Cookie 或真实媒体。
- 测试样例和截图必须使用合成数据。

## 本地开发

```bash
npm install
npm run db:setup
npm run db:demo   # 可选
npm run dev
```

## 提交变更

1. 先创建 Issue，说明问题、影响范围和验证方式。
2. 从最新主分支创建功能分支。
3. 保持改动聚焦，不顺手重构无关模块。
4. 增加或更新测试。
5. 运行：

```bash
npm run typecheck
npm test
npm run build
```

6. 提交时使用 DCO 签名：

```bash
git commit -s -m "feat: describe the change"
```

7. 发起 Pull Request，说明用户影响、隐私影响和安全影响。

## 合并要求

- 至少 2 位维护者批准。
- 所有阻断性意见解决。
- 自动测试通过。
- 涉及会话、权限、上传、投票、数据访问的改动必须有安全说明。
- 任何增加用户数据收集的改动必须同时说明保存位置、访问权限和删除路径。

## 不能通过代码改动改变的事情

- 不能借此获取用户私密数据或生产凭据。
- 不能绕过社区反馈隐藏机制。
- 不能取消真实记录、非 AI、无广告、无新闻、无政治的共同底线。
- 不能把用户内容直接暴露到公开 Issue、CI 或测试样例。

## 许可证

贡献代码按 AGPL-3.0 授权；提交需确认你有权提交该代码，并遵守 DCO。
