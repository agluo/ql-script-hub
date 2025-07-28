# 签到类脚本

> 自动完成各种平台的签到任务，获取签到奖励

## 📋 脚本列表

| 脚本名称 | 描述 | 状态 | 更新时间 |
|---------|------|------|----------|
| example_checkin.js | 签到脚本模板 | ✅ 可用 | 2025-01-01 |
| iqiyi_checkin.js | 爱奇艺VIP签到 | ✅ 可用 | 2025-01-01 |
| weibo_checkin.js | 微博签到 + 超话签到 | ✅ 可用 | 2025-01-01 |

## 🚀 使用方法

### 1. 配置环境变量

在青龙面板中添加以下环境变量：

```bash
# 爱奇艺签到
IQIYI_COOKIES="cookie1@账号1&cookie2@账号2"

# 微博签到
WEIBO_COOKIES="cookie1@账号1&cookie2@账号2"

# 示例脚本（模板）
EXAMPLE_ACCOUNTS="username1:password1@remark1&username2:password2@remark2"
EXAMPLE_COOKIES="cookie1@remark1&cookie2@remark2"
```

### 2. 添加定时任务

在青龙面板中添加定时任务：

```bash
# 爱奇艺签到 - 每天上午9点
0 9 * * * node /ql/scripts/checkin/iqiyi_checkin.js

# 微博签到 - 每天上午9点
0 9 * * * node /ql/scripts/checkin/weibo_checkin.js

# 示例签到 - 每天上午9点
0 9 * * * node /ql/scripts/checkin/example_checkin.js
```

## ⚙️ 环境变量说明

### 通用环境变量

- `NOTIFY_ENABLED`: 是否启用通知 (true/false，默认true)
- `BARK_KEY`: Bark推送Key
- `SERVERCHAN_KEY`: Server酱推送Key
- `PUSHPLUS_TOKEN`: PushPlus推送Token

### 脚本特定环境变量

#### iqiyi_checkin.js (爱奇艺签到)

- `IQIYI_COOKIES`: Cookie格式 `cookie@备注&cookie@备注`
- `IQIYI_DELAY`: 账号间隔时间（毫秒，默认3000）

**功能特点：**
- ✅ 自动签到获取VIP成长值
- ✅ 显示VIP等级和成长值信息
- ✅ 支持多账号批量签到
- ✅ 智能检测已签到状态

#### weibo_checkin.js (微博签到)

- `WEIBO_COOKIES`: Cookie格式 `cookie@备注&cookie@备注`
- `WEIBO_DELAY`: 账号间隔时间（毫秒，默认3000）

**功能特点：**
- ✅ 微博主站签到获取积分
- ✅ 自动超话签到（最多10个）
- ✅ 显示用户信息和粉丝数
- ✅ 支持多账号批量签到
- ✅ 智能检测已签到状态

#### example_checkin.js (示例脚本)

- `EXAMPLE_ACCOUNTS`: 账号密码格式 `username:password@备注&username:password@备注`
- `EXAMPLE_COOKIES`: Cookie格式 `cookie@备注&cookie@备注`
- `EXAMPLE_DELAY`: 账号间隔时间（毫秒，默认3000）

## 📝 Cookie获取方法

### 爱奇艺Cookie获取

1. 打开浏览器，访问 [爱奇艺官网](https://www.iqiyi.com/)
2. 登录你的爱奇艺账号
3. 按F12打开开发者工具
4. 切换到Network(网络)标签
5. 访问 [VIP中心](https://serv.vip.iqiyi.com/vipgrowth/index.action)
6. 在Network中找到请求，复制Cookie值

### 微博Cookie获取

1. 打开浏览器，访问 [微博手机版](https://m.weibo.cn/)
2. 登录你的微博账号
3. 按F12打开开发者工具
4. 切换到Network(网络)标签
5. 刷新页面
6. 在Network中找到请求，复制Cookie值

## 🔧 调试方法

### 1. 本地调试

```bash
# 爱奇艺签到调试
export IQIYI_COOKIES="your_cookie@测试账号"
export DEBUG=true
node iqiyi_checkin.js

# 微博签到调试
export WEIBO_COOKIES="your_cookie@测试账号"
export DEBUG=true
node weibo_checkin.js
```

### 2. 青龙面板调试

在青龙面板的日志中查看执行结果和错误信息。

## ❓ 常见问题

### Q: Cookie失效怎么办？

A: Cookie有有效期限制，失效后需要重新获取：
1. 重新登录对应平台
2. 按照上述方法重新获取Cookie
3. 更新青龙面板中的环境变量

### Q: 签到失败怎么办？

A: 检查以下几点：
1. Cookie是否正确和有效
2. 是否需要人机验证
3. 平台是否更新了接口
4. 网络连接是否正常

### Q: 如何添加新的签到平台？

A: 参考 `example_checkin.js` 模板：
1. 复制模板文件
2. 修改平台相关的接口地址
3. 调整登录和签到逻辑
4. 测试验证功能正常

### Q: 微博超话签到失败？

A: 可能的原因：
1. 没有关注任何超话
2. 超话需要等级限制
3. 超话已经签到过
4. 接口限制或变更

## 🔄 脚本更新

- **v1.0.0** (2025-01-01)
  - 发布爱奇艺签到脚本
  - 发布微博签到脚本（含超话）
  - 完善通知功能和错误处理

## 📞 反馈与建议

如有问题或建议，请在 [Issues](https://github.com/agluo/ql-script-hub/issues) 中反馈。

### 功能请求

欢迎提交新的签到平台需求：
- 腾讯视频
- 优酷视频
- B站
- 网易云音乐
- 其他平台...