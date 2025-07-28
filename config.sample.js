/**
 * QL Script Hub 配置文件示例
 * 复制此文件为 config.js 并根据需要修改配置
 * 
 * @author agluo
 * @version 1.0.0
 */

module.exports = {
    // ==================== 通知配置 ====================
    notify: {
        // 是否启用通知
        enabled: true,
        
        // 通知标题前缀
        title: "QL Script Hub",
        
        // Bark推送 (iOS)
        bark: {
            enabled: false,
            key: "", // 你的Bark Key
            url: "https://api.day.app" // Bark服务器地址
        },
        
        // Server酱推送 (微信)
        serverChan: {
            enabled: false,
            key: "" // 你的Server酱 SCKEY
        },
        
        // PushPlus推送 (微信)
        pushplus: {
            enabled: false,
            token: "" // 你的PushPlus Token
        },
        
        // 钉钉机器人
        dingtalk: {
            enabled: false,
            webhook: "", // 钉钉机器人Webhook地址
            secret: "" // 钉钉机器人加签密钥（可选）
        },
        
        // 企业微信应用
        wecom: {
            enabled: false,
            corpid: "", // 企业ID
            corpsecret: "", // 应用密钥
            agentid: "", // 应用ID
            touser: "@all" // 接收消息的用户
        }
    },

    // ==================== 脚本全局配置 ====================
    global: {
        // 请求超时时间（毫秒）
        timeout: 30000,
        
        // 请求重试次数
        retryTimes: 3,
        
        // 请求间隔时间（毫秒）
        delay: 1000,
        
        // 用户代理
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
        
        // 是否启用调试模式
        debug: false,

        // ==================== 随机启动延时配置 ====================
        // 是否启用随机启动延时（避免所有用户同时执行）
        randomStartEnabled: true,
        
        // 随机延时范围（秒）
        randomStartMin: 0,      // 最小延时：0秒
        randomStartMax: 1800    // 最大延时：30分钟（1800秒）
    },

    // ==================== 签到脚本配置 ====================
    checkin: {
        // 是否启用签到脚本
        enabled: true,
        
        // 签到时间配置（cron表达式）
        schedule: "0 9 * * *", // 每天上午9点执行
        
        // 示例平台配置
        example: {
            enabled: false,
            accounts: [
                {
                    username: "your_username",
                    password: "your_password",
                    cookies: "", // 或者使用cookies登录
                    remark: "账号1"
                }
            ]
        },

        // 什么值得买签到配置
        smzdm: {
            enabled: false,
            cookies: "", // Cookie信息，格式：cookie@备注&cookie@备注
            delay: 3000, // 请求间隔时间（毫秒）
            enableLottery: true // 是否启用每日转盘
        },

        // 百度贴吧签到配置
        tieba: {
            enabled: false,
            cookies: "", // Cookie信息，格式：cookie@备注&cookie@备注
            delay: 2000, // 贴吧间隔时间（毫秒）
            maxBars: 50 // 每个账号最大签到贴吧数
        },

        // IKuuu机场签到配置
        ikuuu: {
            enabled: false,
            accounts: "", // 账号信息，格式：邮箱:密码@备注&邮箱:密码@备注
            cookies: "", // Cookie信息（可选），格式：cookie@备注&cookie@备注
            delay: 3000 // 请求间隔时间（毫秒）
        },

        // 恩山论坛签到配置
        enshan: {
            enabled: false,
            cookies: "", // Cookie信息，格式：cookie@备注&cookie@备注
            delay: 3000 // 请求间隔时间（毫秒）
        },

        // 夸克网盘签到配置
        quark: {
            enabled: false,
            cookies: "", // Cookie信息，格式：cookie@备注&cookie@备注
            delay: 3000 // 请求间隔时间（毫秒）
        }
    },

    // ==================== 薅羊毛脚本配置 ====================
    rewards: {
        // 是否启用薅羊毛脚本
        enabled: true,
        
        // 执行时间配置
        schedule: "0 10,14,18 * * *", // 每天10点、14点、18点执行
        
        // 示例活动配置
        example: {
            enabled: false,
            accounts: [
                {
                    token: "your_token",
                    userId: "your_user_id",
                    remark: "账号1"
                }
            ]
        }
    },

    // ==================== 监控脚本配置 ====================
    monitor: {
        // 是否启用监控脚本
        enabled: true,
        
        // 监控频率配置
        schedule: "0 */30 * * * *", // 每30分钟检查一次
        
        // 示例商品监控配置
        example: {
            enabled: false,
            items: [
                {
                    name: "商品名称",
                    url: "商品链接",
                    targetPrice: 100, // 目标价格
                    currentPrice: 0, // 当前价格（自动获取）
                    remark: "监控商品1"
                }
            ]
        }
    },

    // ==================== 代理配置 ====================
    proxy: {
        // 是否启用代理
        enabled: false,
        
        // 代理类型：http, https, socks4, socks5
        type: "http",
        
        // 代理服务器配置
        host: "127.0.0.1",
        port: 8080,
        auth: {
            username: "",
            password: ""
        }
    },

    // ==================== 数据库配置 ====================
    database: {
        // 是否启用数据库存储
        enabled: false,
        
        // 数据库类型：sqlite, mysql, mongodb
        type: "sqlite",
        
        // SQLite配置
        sqlite: {
            path: "./data/database.db"
        },
        
        // MySQL配置
        mysql: {
            host: "localhost",
            port: 3306,
            username: "root",
            password: "",
            database: "ql_script_hub"
        },
        
        // MongoDB配置
        mongodb: {
            url: "mongodb://localhost:27017/ql_script_hub"
        }
    }
};