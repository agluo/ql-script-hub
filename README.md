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
└── checkin.py             # 签到类脚本
```

## 🚀 快速开始

### 环境要求

- 青龙面板 2.10+
- Node.js 14+

### 安装步骤

1. **拉取仓库**
   ```bash
   # 在青龙面板订阅管理中添加订阅
   # 订阅地址：https://github.com/agluo/ql-script-hub.git
   ```
  <img width="774" height="1112" alt="image" src="https://github.com/user-attachments/assets/de6cf07f-7af2-42b9-8321-c2ccc542820b" />
  
2. **配置环境变量**

   
| 变量名 | 说明 | 是否必需 | 示例值 | 备注 |
|--------|------|----------|--------|------|
| `TG_BOT_TOKEN` | Telegram机器人Token | 推荐 | `1234567890:AAG9rt-6RDaaX0HBLZQq0laNOh898iFYaRQ` | 获取方式见下方说明 |
| `TG_USER_ID` | Telegram用户ID | 推荐 | `1434078534` | 获取方式见下方说明 |
| `PUSH_KEY` | Server酱推送Key | 可选 | `SCTxxxxxxxxxxxxxxxxxxxxx` | 微信推送，访问 sct.ftqq.com 获取 |
| `PUSH_PLUS_TOKEN` | Push+推送Token | 可选 | `xxxxxxxxxxxxxxxxxx` | 微信推送，访问 pushplus.plus 获取 |
| `DD_BOT_TOKEN` | 钉钉机器人Token | 可选 | `xxxxxxxxxxxxxxxxxx` | 钉钉群机器人 |
| `DD_BOT_SECRET` | 钉钉机器人密钥 | 可选 | `xxxxxxxxxxxxxxxxxx` | 钉钉群机器人密钥（可选） |
| `BARK_PUSH` | Bark推送地址 | 可选 | `https://api.day.app/your_key/` | iOS Bark推送 |

#### 📱 NodeSeek 签到配置

| 变量名 | 说明 | 是否必需 | 示例值 | 备注 |
|--------|------|----------|--------|------|
| `NODESEEK_COOKIE` | NodeSeek网站Cookie | **必需** | `cookie1&cookie2&cookie3` | 多账号用`&`分隔 |
| `NS_RANDOM` | 签到随机参数 | 可选 | `true` | 默认值，通常无需修改 |

#### 🏔️ 恩山论坛签到配置

| 变量名 | 说明 | 是否必需 | 示例值 | 备注 |
|--------|------|----------|--------|------|
| `enshan_cookie` | 恩山论坛Cookie | **必需** | `完整的Cookie字符串` | 单账号Cookie |

#### ☁️ 夸克网盘签到配置

| 变量名 | 说明 | 是否必需 | 示例值 | 备注 |
|--------|------|----------|--------|------|
| `QUARK_COOKIE` | 夸克网盘Cookie | **必需** | `cookie1&&cookie2` | 多账号用`&&`或回车分隔 |

#### ⏰ 随机化配置（所有脚本共用）

| 变量名 | 说明 | 是否必需 | 示例值 | 备注 |
|--------|------|----------|--------|------|
| `RANDOM_SIGNIN` | 启用随机签到 | 可选 | `true` | `true`启用，`false`禁用 |
| `MAX_RANDOM_DELAY` | 随机延迟窗口（秒） | 可选 | `3600` | `3600`=1小时，`1800`=30分钟 |

---

## 🔧 获取方式说明

### 📱 Telegram配置获取
1. **创建机器人**: 与 [@BotFather](https://t.me/botfather) 对话，发送 `/newbot` 创建机器人
2. **获取Token**: 创建完成后会收到 `TG_BOT_TOKEN`
3. **获取用户ID**: 与 [@userinfobot](https://t.me/userinfobot) 对话获取 `TG_USER_ID`

### 🍪 Cookie获取方式

#### NodeSeek Cookie
1. 浏览器访问 [nodeseek.com](https://www.nodeseek.com) 并登录
2. F12 开发者工具 → Network → 刷新页面
3. 找到请求头中的 `Cookie` 完整复制

#### 恩山论坛 Cookie  
1. 浏览器访问 [恩山论坛](https://www.right.com.cn/FORUM/) 并登录
2. F12 开发者工具 → Network → 刷新页面
3. 找到请求头中的 `Cookie` 完整复制

#### 夸克网盘 Cookie
1. 浏览器访问 [夸克网盘](https://pan.quark.cn/) 并登录
2. F12 开发者工具 → Network → 刷新页面  
3. 找到请求头中的 `Cookie` 完整复制

---

## 📝 配置示例

```bash
# 通知配置（推荐Telegram）
TG_BOT_TOKEN=1234567890:AAG9rt-6RDaaX0HBLZQq0laNOh898iFYaRQ
TG_USER_ID=1434078534

# 随机化配置（可选）
RANDOM_SIGNIN=true
MAX_RANDOM_DELAY=3600
```

---


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
