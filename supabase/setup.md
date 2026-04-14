# Supabase 接入步骤

## 1. 创建项目

1. 登录 Supabase 控制台并创建新项目。
2. 打开 `SQL Editor`，执行 [`schema.sql`](./schema.sql) 全部内容。

## 2. 配置认证

1. 进入 `Authentication -> Providers`，启用 `Email`。
2. 保持 `Enable Email Signup` 为开启。
3. 推荐开启 `Confirm email`（默认通常已开启）。
4. 在 `Authentication -> URL Configuration` 中设置站点 URL：
   - 本地调试：`http://localhost:8080`
   - 生产环境：你的正式域名（例如 Vercel 域名）

## 3. 填写前端配置

1. 在 `Project Settings -> API` 里找到：
   - `Project URL`
   - `anon public key`
2. 编辑项目根目录 [`cloud-config.js`](../cloud-config.js)：

```js
window.CLOUD_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  otpLength: 6,
};
```

## 4. 验证登录与同步

1. 打开应用。
2. 在左侧“云端同步”中输入邮箱并发送验证码。
3. 在邮箱中查看验证码（默认 6 位），填回应用完成登录，状态会变为“云端在线”。
4. 新建项目和子任务后，刷新页面确认数据仍存在。

## 5. 如果邮件里只有链接没有验证码

1. 打开 `Authentication -> Email Templates`。
2. 在登录模板中使用 `{{ .Token }}` 显示验证码内容。
3. 保存模板后重新发送验证码测试。
