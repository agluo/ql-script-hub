# QL Script Hub

> 🚀 Personal QingLong script hub - one-stop solution for check-ins and monitoring

[中文说明](README.md) | English

[![GitHub stars](https://img.shields.io/github/stars/agluo/ql-script-hub?style=flat-square)](https://github.com/agluo/ql-script-hub/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/agluo/ql-script-hub?style=flat-square)](https://github.com/agluo/ql-script-hub/network)
[![GitHub issues](https://img.shields.io/github/issues/agluo/ql-script-hub?style=flat-square)](https://github.com/agluo/ql-script-hub/issues)
[![License](https://img.shields.io/github/license/agluo/ql-script-hub?style=flat-square)](https://github.com/agluo/ql-script-hub/blob/main/LICENSE)

## 📋 Overview

QL Script Hub is a script collection built for QingLong Panel, providing automation for daily check-ins, monitoring, and similar repetitive tasks. The scripts are intended to be easy to deploy and maintain.

## ✨ Features

- 🎯 **Diverse scripts** - Covers check-ins, notifications, and other automation scenarios
- 🔧 **Easy configuration** - Unified environment-variable based setup
- 📦 **Modular design** - Clear file structure for maintenance and extension
- 🛡️ **Reliable** - Scripts are organized for practical day-to-day usage
- 📝 **Documented** - Includes setup notes and parameter descriptions
- 🔄 **Continuously updated** - Easy to expand with more services over time

## 📁 Project Structure

```text
ql-script-hub/
├── README.md                    # Chinese README
├── README_EN.md                 # English README
├── LICENSE                      # License
├── aliyunpan_checkin.py         # Aliyun Drive check-in
├── baiduwangpan_checkin.py      # Baidu Netdisk check-in
├── deepflood_checkin.py         # Deepflood check-in
├── enshan_checkin.py            # Enshan forum check-in
├── ikuuu_checkin.py             # Ikuuu check-in
├── nga_checkin.py               # NGA forum check-in
├── nodeseek_checkin.py          # NodeSeek check-in
├── quark_signin.py              # Quark Drive sign-in
├── CDRail.py                    # Chengdu Metro sign-in
├── SFSU_checkin.py              # SF Express sign-in
├── SMZDM_checkin.py             # SMZDM sign-in
├── tieba_checkin.py             # Baidu Tieba sign-in
├── ty_netdisk_checkin.py        # Tianyi Cloud Drive sign-in
└── archive/
    └── leaflow_checkin.pyleaflow_checkin.py
```

## 🚀 Quick Start

### Requirements

- QingLong Panel 2.10+
- Node.js 14+

### Installation

1. **Pull the repository**

   ```bash
   # Add this repository in QingLong subscription management
   # Subscription URL: https://github.com/agluo/ql-script-hub.git
   ```

   <img width="774" height="1112" alt="image" src="https://github.com/user-attachments/assets/de6cf07f-7af2-42b9-8321-c2ccc542820b" />

2. **Configure environment variables**

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `TG_BOT_TOKEN` | Telegram bot token | Recommended | `1234567890:AAG9rt-6RDaaX0HBLZQq0laNOh898iFYaRQ` | See instructions below |
| `TG_USER_ID` | Telegram user ID | Recommended | `1434078534` | See instructions below |
| `PUSH_KEY` | ServerChan push key | Optional | `SCTxxxxxxxxxxxxxxxxxxxxx` | For WeChat push via `sct.ftqq.com` |
| `PUSH_PLUS_TOKEN` | Push+ token | Optional | `xxxxxxxxxxxxxxxxxx` | For WeChat push via `pushplus.plus` |
| `DD_BOT_TOKEN` | DingTalk bot token | Optional | `xxxxxxxxxxxxxxxxxx` | DingTalk group bot |
| `DD_BOT_SECRET` | DingTalk bot secret | Optional | `xxxxxxxxxxxxxxxxxx` | Optional bot signing secret |
| `BARK_PUSH` | Bark push URL | Optional | `https://api.day.app/your_key/` | Bark push for iOS |

#### 🏔️ Enshan Forum

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `enshan_cookie` | Enshan forum cookie | **Required** | `full cookie string` | Single-account cookie |

#### 📱 NodeSeek

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `NODESEEK_COOKIE` | NodeSeek cookie | **Required** | `cookie1\ncookie2\ncookie3` | Separate multiple accounts with new lines |
| `NS_RANDOM` | Random sign-in parameter | Optional | `true` | Usually no need to change |

#### ☁️ Quark Drive

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `QUARK_COOKIE` | Quark Drive cookie | **Required** | `cookie1\ncookie2` | Separate multiple accounts with new lines |

#### 🚇 Chengdu Metro

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `CDRAIL_DATA` | Chengdu Metro request data extracted from captured headers | **Required** | `{"token":"xxx","app-token":"yyy","Cookie":"zzz"}` | Supports `JSON`; separate multiple accounts with new lines |

`CDRAIL_DATA` should include the following fields, preferably copied directly from the captured request headers:

| Field | Required | Description |
|------|----------|------|
| `token` | **Required** | The `token` value from request headers |
| `app-token` | **Required** | The `app-token` value from request headers |
| `Cookie` / `cookie` | **Required** | Logged-in cookie; the script handles case differences automatically |
| `deviceId` / `device-id` | Recommended | Device identifier; the repository default is only a placeholder, so using your own captured device ID is recommended |

Example formats:

```bash
# Single account in JSON format (recommended)
export CDRAIL_DATA='{"token":"xxx","app-token":"yyy","Cookie":"zzz","deviceId":"xxx-xxx"}'

# Single account in querystring format
export CDRAIL_DATA='token=xxx&app-token=yyy&cookie=zzz&deviceId=xxx-xxx'

# Multiple accounts: separated by new lines or `@`
export CDRAIL_DATA='{"token":"t1","app-token":"a1","Cookie":"c1","deviceId":"d1"}
{"token":"t2","app-token":"a2","Cookie":"c2","deviceId":"d2"}'
```

#### 📦 SF Express

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `sfsyUrl` | SF Express login URL | **Required** | `https://mcs-mimp...` | Capture from network traffic, one per line for multiple accounts |

#### Baidu Tieba

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `TIEBA_COOKIE` | Baidu Tieba cookie | **Required** | `BDUSS=xxxxxx; STOKEN=xxxxx...` | Full cookie string, one account per line |

#### ☁️ Aliyun Drive

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `ALIYUN_REFRESH_TOKEN` | Aliyun Drive `refresh_token` | **Required** | `crsh166bdfde4751a4c0...` | Separate multiple accounts with new lines |
| `AUTO_UPDATE_TOKEN` | Auto update token | Optional | `true` | Default is `true` |
| `PRIVACY_MODE` | Privacy mode | Optional | `true` | Default is `true`, masks sensitive values |

#### 🛒 SMZDM

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `SMZDM_COOKIE` | SMZDM cookie | **Required** | `__ckguid==xxxxx; device_id=xxxxx...` | Full cookie string, one account per line |

#### ☁️ Baidu Netdisk

| Variable | Description | Example |
|--------|------|------|
| `BAIDU_COOKIE` | Website cookie | `BDUSS=xxx; STOKEN=xxx...` |
| `PRIVACY_MODE` | Privacy mode | `true` |

#### 📡 Ikuuu

| Variable | Description | Example |
|--------|------|------|
| `IKUUU_EMAIL` | Login email | `user@example.com` |
| `IKUUU_PASSWD` | Login password | `password123` |

#### ☁️ Tianyi Cloud Drive

| Variable | Description | Example |
|--------|------|------|
| `TY_USERNAME` | Login phone number | `13812345678` |
| `TY_PASSWORD` | Login password | `password1` |

#### 🎮 NGA Forum

| Variable | Description | Example |
|--------|------|------|
| `NGA_CREDENTIALS` | UID and AccessToken | `12345678,abcdef...` |

#### 📱 Deepflood

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `DEEPFLOOD_COOKIE` | Deepflood website cookie | **Required** | `cookie1\ncookie2\ncookie3` | Separate multiple accounts with new lines |
| `NS_RANDOM` | Random sign-in parameter | Optional | `true` | Usually no need to change |

#### ☁️ Leaflow

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `LEAFLOW_COOKIE` | Leaflow website cookie | **Required** | `cookie` | Separate multiple accounts with new lines |

#### ⏰ Randomization Settings (shared by all scripts)

| Variable | Description | Required | Example | Notes |
|--------|------|----------|--------|------|
| `RANDOM_SIGNIN` | Enable random sign-in | Optional | `true` | `true` to enable, `false` to disable |
| `MAX_RANDOM_DELAY` | Random delay window in seconds | Optional | `3600` | `3600` = 1 hour, `1800` = 30 minutes |

---

## 🔧 How to Obtain Required Values

### 📱 Telegram Setup
1. **Create a bot**: Chat with [@BotFather](https://t.me/botfather) and send `/newbot`
2. **Get the token**: After creation, BotFather returns your `TG_BOT_TOKEN`
3. **Get user ID**: Chat with [@userinfobot](https://t.me/userinfobot) to get `TG_USER_ID`

### 🍪 Cookie / Credential Collection

#### Enshan forum cookie
1. Visit [Enshan Forum](https://www.right.com.cn/FORUM/) and sign in
2. Open developer tools with `F12` → `Network` → refresh the page
3. Copy the full `Cookie` value from request headers

#### NodeSeek cookie
1. Visit [nodeseek.com](https://www.nodeseek.com) and sign in
2. Open developer tools with `F12` → `Network` → refresh the page
3. Copy the full `Cookie` value from request headers

#### Deepflood cookie
1. Visit [deepflood.com](https://www.deepflood.com) and sign in
2. Open developer tools with `F12` → `Network` → refresh the page
3. Copy the full `Cookie` value from request headers

#### Quark Drive cookie
1. Visit [Quark Drive](https://pan.quark.cn/) and sign in
2. Open developer tools with `F12` → `Network` → refresh the page
3. Copy the full `Cookie` value from request headers

#### SF Express `sfsyUrl`
1. Bind WeChat in the SF Express app, then send "顺丰" to the bot
2. Open the mini program or app → My → Points, and capture one of these URLs:
   - `https://mcs-mimp-web.sf-express.com/mcs-mimp/share/weChat/shareGiftReceiveRedirect`
   - `https://mcs-mimp-web.sf-express.com/mcs-mimp/share/app/shareRedirect`
3. Encode the captured URL using a tool such as [URL Encoder](https://www.toolhelper.cn/EncodeDecode/Url)

#### Baidu Tieba cookie
1. Visit [tieba.baidu.com](https://tieba.baidu.com) and sign in
2. Open developer tools with `F12` → `Network` → refresh the page
3. Copy the full `Cookie` value from request headers
4. Make sure the cookie contains `BDUSS`

#### Aliyun Drive `refresh_token`
1. Visit [Aliyun Drive Web](https://www.aliyundrive.com/) and sign in
2. Press `F12` → open the `Application` tab
3. Find `Local Storage` → `https://www.aliyundrive.com`
4. Locate `token` and copy the `refresh_token` value

#### SMZDM cookie
1. Visit [SMZDM](https://www.smzdm.com/) and sign in
2. Press `F12` → open the `Network` tab
3. Refresh the page and open any request's `Request Headers`
4. Copy the full `Cookie` value

#### Baidu Netdisk cookie
1. Visit [Baidu Netdisk](https://pan.baidu.com/) and sign in
2. Press `F12` → `Network` → copy the cookie

#### Ikuuu configuration
1. Add `IKUUU_EMAIL` in QingLong Panel
2. Add `IKUUU_PASSWD` in QingLong Panel
3. Separate multiple accounts with commas, e.g. `email1,email2`
4. Keep password order aligned with email order

#### Tianyi Cloud Drive configuration
1. Visit [Tianyi Cloud Drive](https://e.dlife.cn/index.do) and disable device lock
2. Add `TY_USERNAME` in QingLong Panel
3. Add `TY_PASSWD` in QingLong Panel

#### Leaflow configuration
1. Visit [leaflow](https://leaflow.net/workspaces) and disable device lock
2. Click the trial sign-in entry
3. Open developer tools with `F12` and go to the network panel
4. Click sign in
5. Inspect the newly generated request
6. Find the cookie value containing `PHPSESSID=XXXXX`

#### NGA forum configuration
1. Install a packet capture tool with HTTPS decryption enabled and trust its certificate. Android: HTTP Canary, HttpToolkit, mitmproxy, Charles; iOS: Stream, Charles
2. Route the phone network through the capture tool (or use its local VPN / proxy mode)
3. Open the official NGA app, make sure you are signed in, then perform any action to trigger a request
4. Find the POST request sent to `https://ngabbs.com/nuke.php`
5. Open the request body (`Content-Type` is usually `application/x-www-form-urlencoded`) and copy: `access_uid=yourUID` and `access_token=long_string`
6. Combine them as `UID,AccessToken` and store them in `NGA_CREDENTIALS`
   - Single account: `123456,abcdefg`
   - Multiple accounts: `123456,abcdefg&234567,hijklmn`

---

## 📝 Configuration Example

```bash
# Notifications (Telegram recommended)
TG_BOT_TOKEN=1234567890:AAG9rt-6RDaaX0HBLZQq0laNOh898iFYaRQ
TG_USER_ID=1434078534

# Randomization settings (optional)
RANDOM_SIGNIN=true
MAX_RANDOM_DELAY=3600
```

---

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 Disclaimer

- This project is for learning and personal communication only
- The author is not responsible for any issues caused by using this project
- Please comply with the target websites' terms of service and local laws

## 📞 Contact

- GitHub: [@agluo](https://github.com/agluo)
- Issues: [Project issue tracker](https://github.com/agluo/ql-script-hub/issues)

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## ⭐ Star History

If this project helps you, a star is appreciated ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=agluo/ql-script-hub&type=Date)](https://star-history.com/#agluo/ql-script-hub&Date)
