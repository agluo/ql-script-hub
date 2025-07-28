# QL Script Hub

> 🚀 个人青龙面板脚本库 - 签到、薅羊毛、监控一站式解决方案

[![GitHub stars](https://img.shields.io/github/stars/agluo/ql-script-hub?style=flat-square)](https://github.com/agluo/ql-script-hub/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/agluo/ql-script-hub?style=flat-square)](https://github.com/agluo/ql-script-hub/network)
[![GitHub issues](https://img.shields.io/github/issues/agluo/ql-script-hub?style=flat-square)](https://github.com/agluo/ql-script-hub/issues)
[![License](https://img.shields.io/github/license/agluo/ql-script-hub?style=flat-square)](https://github.com/agluo/ql-script-hub/blob/main/LICENSE)

## 📋 项目简介

QL Script Hub 是一个专为青龙面板打造的综合性脚本库，提供签到、薅羊毛、监控等多种类型的自动化脚本。所有脚本均经过测试，确保稳定可靠。

## ✨ 功能特性

- 🎯 **多样化脚本** - 涵盖签到、薅羊毛、监控等多种场景
- 🔧 **易于配置** - 统一的配置文件格式，简单易懂
- 📦 **模块化设计** - 清晰的目录结构，便于管理和扩展
- 🛡️ **安全可靠** - 所有脚本均经过测试，保证安全性
- 📝 **详细文档** - 每个脚本都有详细的使用说明
- 🔄 **持续更新** - 定期更新维护，修复问题和添加新功能

## 📁 目录结构

```
ql-script-hub/
├── README.md              # 项目说明文档
├── LICENSE                # 开源许可证
├── config.sample.js       # 配置文件示例
├── .gitignore            # Git忽略文件
├── checkin/              # 签到类脚本
│   ├── README.md         # 签到脚本说明
│   └── example_checkin.js # 签到示例脚本
├── rewards/              # 薅羊毛类脚本
│   ├── README.md         # 薅羊毛脚本说明
│   └── example_rewards.js # 薅羊毛示例脚本
├── monitor/              # 监控类脚本
│   ├── README.md         # 监控脚本说明
│   └── example_monitor.js # 监控示例脚本
└── utils/                # 工具函数库
    ├── common.js         # 通用工具函数
    └── notify.js         # 通知模块
```

## 🚀 快速开始

### 环境要求

- 青龙面板 2.10+
- Node.js 14+

### 安装步骤

1. **拉取仓库**
   ```bash
   # 在青龙面板中添加订阅
   # 订阅地址：https://github.com/agluo/ql-script-hub.git
   ```

2. **配置环境变量**
   ```bash
   # 复制配置文件模板
   cp config.sample.js config.js
   
   # 编辑配置文件，填入你的账号信息
   ```

3. **运行脚本**
   ```bash
   # 在青龙面板中创建定时任务
   node checkin/example_checkin.js
   ```

## 📂 脚本分类

### 🎯 签到脚本 (checkin/)
自动完成各种平台的签到任务，获取签到奖励。

**支持平台：**
- 爱奇艺VIP签到 (iqiyi_checkin.js) - 获取VIP成长值
- 微博签到 (weibo_checkin.js) - 主站签到 + 超话签到
- 示例签到脚本 (example_checkin.js) - 开发模板

### 💰 薅羊毛脚本 (rewards/)
自动参与各种活动，获取优惠券、积分等奖励。

**支持活动：**
- 示例薅羊毛脚本 (example_rewards.js) - 开发模板
- 待添加更多平台活动...

### 📊 监控脚本 (monitor/)
监控商品价格、库存等信息，及时通知变化。

**监控功能：**
- 京东价格监控 (jd_price_monitor.js) - 价格变动、目标价格、库存监控
- 示例监控脚本 (example_monitor.js) - 开发模板

### 🛠️ 工具函数 (utils/)
提供通用的工具函数和通知模块。

**功能模块：**
- `common.js` - 通用工具函数
- `notify.js` - 多平台通知模块

## ⚙️ 配置说明

1. 复制 `config.sample.js` 为 `config.js`
2. 根据需要修改配置参数
3. 在青龙面板中设置对应的环境变量

```javascript
// 配置示例
module.exports = {
    // 通知配置
    notify: {
        bark: "your_bark_key",
        serverChan: "your_server_chan_key",
        pushplus: "your_pushplus_token"
    },
    
    // 脚本配置
    scripts: {
        checkin: {
            enabled: true,
            interval: "0 9 * * *"  // 每天9点执行
        }
    }
};
```

## 📱 通知配置

支持多种通知方式：

- **Bark** - iOS推送通知
- **Server酱** - 微信推送
- **PushPlus** - 微信推送
- **钉钉机器人** - 群组通知
- **企业微信** - 企业通知

## 🤝 贡献指南

欢迎贡献代码和提出建议！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 免责声明

- 本项目仅供学习交流使用，请勿用于商业用途
- 使用本项目所产生的任何问题，作者不承担任何责任
- 请遵守相关网站的使用条款和法律法规

## 📞 联系方式

- GitHub: [@agluo](https://github.com/agluo)
- Issues: [项目问题反馈](https://github.com/agluo/ql-script-hub/issues)

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=agluo/ql-script-hub&type=Date)](https://star-history.com/#agluo/ql-script-hub&Date)