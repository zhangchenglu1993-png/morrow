# 部署到阿里云轻量服务器

本文档假设使用 99 元/年档位的 Linux 轻量服务器、域名已解析到服务器，Node.js 24 可用。第一版数据库为 SQLite，媒体文件写入持久目录；生产扩容前应替换为 OSS。

## 1. 服务器准备

```bash
sudo apt update
sudo apt install -y caddy sqlite3 git
```

安装 Node.js 24，创建独立系统用户：

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin morrow
sudo mkdir -p /opt/morrow /var/lib/morrow/data /var/lib/morrow/uploads /var/backups/morrow
sudo chown -R morrow:morrow /opt/morrow /var/lib/morrow /var/backups/morrow
```

## 2. 代码与配置

```bash
sudo -u morrow git clone <你的仓库地址> /opt/morrow
cd /opt/morrow
sudo -u morrow npm ci
```

创建 `/etc/morrow.env`：

```bash
MORROW_APP_URL=https://your-domain.example
MORROW_DB_PATH=/var/lib/morrow/data/morrow.db
MORROW_UPLOAD_DIR=/var/lib/morrow/uploads
RESEND_API_KEY=your-key
MORROW_FROM_EMAIL=Morrow <hello@your-domain.example>
NODE_ENV=production
```

生产环境不要写入负责人密码。首次初始化时临时设置：

```bash
sudo -u morrow env $(cat /etc/morrow.env | xargs) \
  MORROW_OWNER_EMAIL=you@example.com \
  MORROW_OWNER_PASSWORD='一次性强密码' \
  npm run db:setup
```

保存输出的邀请码，并立即妥善保存密码。

## 3. 构建

```bash
cd /opt/morrow
sudo -u morrow npm run build
sudo -u morrow cp -r public .next/standalone/public
sudo -u morrow mkdir -p .next/standalone/.next
sudo -u morrow cp -r .next/static .next/standalone/.next/static
```

## 4. 系统服务

```bash
sudo cp deploy/morrow.service /etc/systemd/system/morrow.service
sudo systemctl daemon-reload
sudo systemctl enable --now morrow
sudo systemctl status morrow
```

## 5. HTTPS 反向代理

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

部署前确认：

- 域名解析正确。
- 80/443 端口开放。
- `/etc/morrow.env` 权限为 `600`。
- 生产环境已配置真实邮件发送服务。
- 数据库和上传目录位于持久磁盘。

## 6. 备份

每日备份示例：

```bash
sudo -u morrow sqlite3 /var/lib/morrow/data/morrow.db \
  ".backup '/var/backups/morrow/morrow-$(date +%F).db'"
```

同时备份 `/var/lib/morrow/uploads`。备份文件应加密并定期做恢复演练。私密记录不在服务端，因此不进入备份。

## 7. 更新

```bash
cd /opt/morrow
sudo -u morrow git pull
sudo -u morrow npm ci
sudo -u morrow npm test
sudo -u morrow npm run build
sudo -u morrow cp -r public .next/standalone/public
sudo -u morrow cp -r .next/static .next/standalone/.next/static
sudo systemctl restart morrow
```

Fork 的 Pull Request 不会自动部署。生产发布必须由维护者从受保护主分支手动触发。
