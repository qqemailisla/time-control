# 学业时间管理软件（GitHub + Supabase 云同步版）

这是一个莫兰迪浅蓝风格的学习项目管理应用，支持：

- 多项目管理（项目名 + 预计开始/结束时间）
- 项目内多子任务
- 子任务支持预计开始/结束时间，并显示时间进度百分比
- 子任务勾选完成后记录完成日期，默认隐藏
- 任务视图 / 日历缩略图视图切换
- 番茄钟页面（正向计时、工作记录、效率标记）
- 右侧时间进度条自动计算
- Supabase 邮箱验证码登录与云端同步

## 项目结构

- `index.html`：页面结构
- `styles.css`：UI 样式
- `app.js`：业务逻辑与 Supabase 同步
- `cloud-config.js`：Supabase 前端配置（需填写）
- `cloud-config.example.js`：配置示例
- `supabase/schema.sql`：数据库建表 + RLS
- `supabase/setup.md`：Supabase 配置说明
- `vercel.json`：静态部署配置

## 本地运行

直接打开 `index.html` 即可。

推荐使用本地静态服务：

```powershell
python -m http.server 8080
```

访问 [http://localhost:8080](http://localhost:8080)。

## 接入 Supabase

1. 按 [`supabase/setup.md`](./supabase/setup.md) 创建 Supabase 项目并执行 SQL。
2. 编辑 [`cloud-config.js`](./cloud-config.js)，填入 URL 和 anon key。
3. 启动应用后用邮箱验证码登录，完成云端同步。

## 上传到 GitHub

在项目目录执行：

```powershell
git init
git add .
git commit -m "Initial study planner with Supabase sync"
git branch -M main
git remote add origin <你的仓库地址>
git push -u origin main
```

## 部署到云端（Vercel）

你可以在 Vercel 控制台“Import Git Repository”，直接选择这个 GitHub 仓库完成部署。

或者使用 CLI：

```powershell
vercel
vercel --prod
```

> 首次部署后，记得在 Supabase 的 `Authentication -> URL Configuration` 里把生产域名加入允许列表。
