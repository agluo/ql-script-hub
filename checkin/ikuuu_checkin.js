/**
 * IKuuu机场签到脚本
 * 
 * @name IKuuu机场签到
 * @description 自动完成IKuuu机场每日签到，获取流量奖励
 * @author agluo
 * @version 1.0.0
 * @env IKUUU_ACCOUNTS 账号信息，格式：邮箱:密码@备注&邮箱:密码@备注
 * @env IKUUU_COOKIES Cookie信息（可选），格式：cookie@备注&cookie@备注
 * @env IKUUU_DELAY 请求间隔时间（毫秒），默认3000
 * @cron 0 10 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class IKuuuCheckin {
    constructor() {
        this.name = 'IKuuu机场签到';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('IKUUU_DELAY', '3000'));
        
        // 初始化通知管理器
        this.notify = new NotifyManager(this.getNotifyConfig());
        
        // 结果统计
        this.results = {
            total: 0,
            success: 0,
            failed: 0,
            details: []
        };

        CommonUtils.log(`${this.name} v${this.version} 开始执行`);
        CommonUtils.log(`共获取到 ${this.accounts.length} 个账号`);
    }

    /**
     * 获取账号配置
     */
    getAccounts() {
        const accounts = [];
        
        // 优先使用账号密码配置
        const accountsEnv = CommonUtils.getEnv('IKUUU_ACCOUNTS');
        if (accountsEnv) {
            const accountList = accountsEnv.split('&');
            accountList.forEach((account, index) => {
                const [credentials, remark] = account.split('@');
                const [email, password] = credentials.split(':');
                if (email && password) {
                    accounts.push({
                        type: 'account',
                        email: email,
                        password: password,
                        remark: remark || `账号${index + 1}`
                    });
                }
            });
        }

        // 备用Cookie配置
        const cookiesEnv = CommonUtils.getEnv('IKUUU_COOKIES');
        if (cookiesEnv && accounts.length === 0) {
            const cookieList = cookiesEnv.split('&');
            cookieList.forEach((cookie, index) => {
                const [cookieValue, remark] = cookie.split('@');
                if (cookieValue) {
                    accounts.push({
                        type: 'cookie',
                        cookie: cookieValue,
                        remark: remark || `Cookie${index + 1}`
                    });
                }
            });
        }

        if (accounts.length === 0) {
            CommonUtils.error('未获取到有效账号，请检查环境变量配置');
            CommonUtils.log('环境变量格式：IKUUU_ACCOUNTS="邮箱:密码@备注&邮箱:密码@备注"');
            CommonUtils.log('或：IKUUU_COOKIES="cookie@备注&cookie@备注"');
        }

        return accounts;
    }

    /**
     * 获取通知配置
     */
    getNotifyConfig() {
        return {
            enabled: CommonUtils.getEnv('NOTIFY_ENABLED', 'true') === 'true',
            title: this.name,
            bark: {
                enabled: !!CommonUtils.getEnv('BARK_KEY'),
                key: CommonUtils.getEnv('BARK_KEY')
            },
            serverChan: {
                enabled: !!CommonUtils.getEnv('SERVERCHAN_KEY'),
                key: CommonUtils.getEnv('SERVERCHAN_KEY')
            },
            pushplus: {
                enabled: !!CommonUtils.getEnv('PUSHPLUS_TOKEN'),
                token: CommonUtils.getEnv('PUSHPLUS_TOKEN')
            }
        };
    }

    /**
     * 发送HTTP请求
     */
    async request(options) {
        const config = {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await axios(config);
            return {
                success: true,
                data: response.data,
                status: response.status,
                headers: response.headers
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: error.response ? error.response.status : 0
            };
        }
    }

    /**
     * 用户登录
     */
    async login(account) {
        try {
            // 首先访问登录页面获取必要的参数
            const loginPageResponse = await this.request({
                url: 'https://ikuuu.co/auth/login',
                method: 'GET'
            });

            if (!loginPageResponse.success) {
                throw new Error('访问登录页面失败');
            }

            // 构建登录参数
            const loginData = {
                email: account.email,
                passwd: account.password,
                code: '',
                remember_me: 'on'
            };

            const response = await this.request({
                url: 'https://ikuuu.co/auth/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://ikuuu.co/auth/login',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                data: new URLSearchParams(loginData).toString()
            });

            if (response.success) {
                const cookies = response.headers['set-cookie'];
                if (cookies) {
                    const sessionCookie = cookies.find(cookie => cookie.includes('session'));
                    if (sessionCookie) {
                        return {
                            success: true,
                            cookie: cookies.join('; ')
                        };
                    }
                }
                
                // 检查响应内容判断登录状态
                if (typeof response.data === 'object' && response.data.ret === 1) {
                    return {
                        success: true,
                        cookie: response.headers['set-cookie']?.join('; ') || ''
                    };
                } else if (typeof response.data === 'string' && response.data.includes('用户中心')) {
                    return {
                        success: true,
                        cookie: response.headers['set-cookie']?.join('; ') || ''
                    };
                } else {
                    throw new Error('登录失败，请检查账号密码');
                }
            } else {
                throw new Error(response.error || '登录请求失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取用户信息
     */
    async getUserInfo(cookie) {
        try {
            const response = await this.request({
                url: 'https://ikuuu.co/user',
                method: 'GET',
                headers: {
                    'Cookie': cookie,
                    'Referer': 'https://ikuuu.co/'
                }
            });

            if (response.success && response.data) {
                // 解析用户信息
                const html = response.data;
                
                // 提取用户名
                let username = '未知用户';
                const usernameMatch = html.match(/用户名[:：]\s*([^<\n]+)/i) || html.match(/class="username"[^>]*>([^<]+)/i);
                if (usernameMatch) {
                    username = usernameMatch[1].trim();
                }

                // 提取等级信息
                let level = '普通用户';
                const levelMatch = html.match(/等级[:：]\s*([^<\n]+)/i) || html.match(/class="level"[^>]*>([^<]+)/i);
                if (levelMatch) {
                    level = levelMatch[1].trim();
                }

                // 提取流量信息
                let traffic = '未知';
                const trafficMatch = html.match(/剩余流量[:：]\s*([^<\n]+)/i) || html.match(/class="traffic"[^>]*>([^<]+)/i);
                if (trafficMatch) {
                    traffic = trafficMatch[1].trim();
                }

                // 提取到期时间
                let expireTime = '未知';
                const expireMatch = html.match(/到期时间[:：]\s*([^<\n]+)/i) || html.match(/class="expire"[^>]*>([^<]+)/i);
                if (expireMatch) {
                    expireTime = expireMatch[1].trim();
                }

                return {
                    success: true,
                    data: {
                        username,
                        level,
                        traffic,
                        expireTime
                    }
                };
            } else {
                throw new Error('获取用户信息失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 执行签到
     */
    async doCheckin(cookie) {
        try {
            const response = await this.request({
                url: 'https://ikuuu.co/user/checkin',
                method: 'POST',
                headers: {
                    'Cookie': cookie,
                    'Referer': 'https://ikuuu.co/user',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: ''
            });

            if (response.success && response.data) {
                const data = response.data;
                
                // JSON响应
                if (typeof data === 'object') {
                    if (data.ret === 1) {
                        return {
                            success: true,
                            message: data.msg || '签到成功',
                            reward: this.extractReward(data.msg)
                        };
                    } else {
                        if (data.msg && data.msg.includes('已经签到')) {
                            return {
                                success: true,
                                message: '今日已签到',
                                alreadySigned: true
                            };
                        } else {
                            throw new Error(data.msg || '签到失败');
                        }
                    }
                }
                
                // HTML响应
                else if (typeof data === 'string') {
                    if (data.includes('签到成功') || data.includes('获得了')) {
                        return {
                            success: true,
                            message: '签到成功',
                            reward: this.extractReward(data)
                        };
                    } else if (data.includes('已经签到')) {
                        return {
                            success: true,
                            message: '今日已签到',
                            alreadySigned: true
                        };
                    } else {
                        throw new Error('签到失败');
                    }
                }
                
                else {
                    throw new Error('签到响应格式异常');
                }
            } else {
                throw new Error(response.error || '签到请求失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 提取奖励信息
     */
    extractReward(message) {
        if (!message) return '';
        
        // 匹配流量奖励
        const trafficMatch = message.match(/(\d+\.?\d*)\s*(MB|GB|TB)/i);
        if (trafficMatch) {
            return `+${trafficMatch[1]}${trafficMatch[2]}`;
        }

        // 匹配其他奖励信息
        const rewardMatch = message.match(/获得了?\s*([^，。！]+)/);
        if (rewardMatch) {
            return rewardMatch[1].trim();
        }

        return '';
    }

    /**
     * 处理单个账号
     */
    async processAccount(account, index) {
        CommonUtils.log(`\n========== 处理第${index + 1}个账号: ${account.remark} ==========`);
        
        try {
            let cookie = '';
            
            // 登录获取Cookie或直接使用Cookie
            if (account.type === 'account') {
                CommonUtils.log(`[${account.remark}] 正在登录...`);
                const loginResult = await this.login(account);
                if (!loginResult.success) {
                    this.results.failed++;
                    this.results.details.push({
                        account: account.remark,
                        status: 'failed',
                        error: `登录失败: ${loginResult.error}`
                    });
                    return;
                }
                cookie = loginResult.cookie;
                CommonUtils.success(`[${account.remark}] 登录成功`);
            } else {
                cookie = account.cookie;
            }

            // 获取用户信息
            const userInfo = await this.getUserInfo(cookie);
            if (!userInfo.success) {
                CommonUtils.warn(`[${account.remark}] 获取用户信息失败: ${userInfo.error}`);
            } else {
                CommonUtils.log(`[${account.remark}] 用户: ${userInfo.data.username}`);
                CommonUtils.log(`[${account.remark}] 等级: ${userInfo.data.level}`);
                CommonUtils.log(`[${account.remark}] 剩余流量: ${userInfo.data.traffic}`);
                CommonUtils.log(`[${account.remark}] 到期时间: ${userInfo.data.expireTime}`);
            }

            // 执行签到
            const checkinResult = await this.doCheckin(cookie);
            if (checkinResult.success) {
                if (checkinResult.alreadySigned) {
                    CommonUtils.log(`[${account.remark}] ${checkinResult.message}`);
                } else {
                    const reward = checkinResult.reward ? ` (${checkinResult.reward})` : '';
                    CommonUtils.success(`[${account.remark}] ${checkinResult.message}${reward}`);
                }
                
                this.results.success++;
                this.results.details.push({
                    account: account.remark,
                    status: 'success',
                    user: userInfo.success ? userInfo.data.username : '未知用户',
                    level: userInfo.success ? userInfo.data.level : '未知',
                    traffic: userInfo.success ? userInfo.data.traffic : '未知',
                    expireTime: userInfo.success ? userInfo.data.expireTime : '未知',
                    message: checkinResult.message,
                    reward: checkinResult.reward || '',
                    alreadySigned: checkinResult.alreadySigned || false
                });
            } else {
                CommonUtils.error(`[${account.remark}] 签到失败: ${checkinResult.error}`);
                this.results.failed++;
                this.results.details.push({
                    account: account.remark,
                    status: 'failed',
                    user: userInfo.success ? userInfo.data.username : '未知用户',
                    error: checkinResult.error
                });
            }

        } catch (error) {
            CommonUtils.error(`[${account.remark}] 处理异常: ${error.message}`);
            this.results.failed++;
            this.results.details.push({
                account: account.remark,
                status: 'failed',
                error: error.message
            });
        }

        // 账号间隔延时
        if (index < this.accounts.length - 1) {
            CommonUtils.log(`等待 ${this.delay}ms 后处理下一个账号...`);
            await CommonUtils.wait(this.delay);
        }
    }

    /**
     * 生成结果报告
     */
    generateReport() {
        let report = `📊 ${this.name} 执行结果\n\n`;
        report += `🎯 总账号数: ${this.results.total}\n`;
        report += `✅ 成功: ${this.results.success}\n`;
        report += `❌ 失败: ${this.results.failed}\n\n`;

        // 详细结果
        this.results.details.forEach((detail, index) => {
            report += `${index + 1}. ${detail.account}`;
            if (detail.user) {
                report += ` (${detail.user})`;
            }
            report += `:\n`;
            
            if (detail.status === 'success') {
                report += `   ✅ ${detail.message}`;
                if (detail.reward) {
                    report += ` (${detail.reward})`;
                }
                report += '\n';
                
                if (detail.traffic) {
                    report += `   📊 剩余流量: ${detail.traffic}\n`;
                }
                if (detail.expireTime) {
                    report += `   ⏰ 到期时间: ${detail.expireTime}\n`;
                }
            } else {
                report += `   ❌ ${detail.error}\n`;
            }
        });

        report += `\n⏰ 执行时间: ${CommonUtils.formatTime()}`;
        return report;
    }

    /**
     * 主执行函数
     */
    async main() {
        try {
            // 随机启动延时，避免所有用户同时执行
            await CommonUtils.randomStartDelay();

            if (this.accounts.length === 0) {
                await this.notify.sendError(this.name, '未获取到有效账号，请检查环境变量配置');
                return;
            }

            this.results.total = this.accounts.length;

            // 处理所有账号
            for (let i = 0; i < this.accounts.length; i++) {
                await this.processAccount(this.accounts[i], i);
            }

            // 生成并输出结果报告
            const report = this.generateReport();
            CommonUtils.log('\n' + report);

            // 发送通知
            if (this.results.failed === 0) {
                await this.notify.sendSuccess(this.name, report);
            } else if (this.results.success > 0) {
                await this.notify.sendWarning(this.name, report);
            } else {
                await this.notify.sendError(this.name, report);
            }

        } catch (error) {
            const errorMsg = `脚本执行异常: ${error.message}`;
            CommonUtils.error(errorMsg);
            await this.notify.sendError(this.name, errorMsg);
        }

        CommonUtils.log(`\n${this.name} 执行完成`);
    }
}

// 直接执行脚本
if (require.main === module) {
    new IKuuuCheckin().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = IKuuuCheckin;