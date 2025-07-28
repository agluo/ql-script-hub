/**
 * 示例签到脚本
 * 
 * @name 示例平台签到
 * @description 自动完成示例平台的签到任务
 * @author agluo
 * @version 1.0.0
 * @env EXAMPLE_ACCOUNTS 账号密码，格式：username:password@备注&username:password@备注
 * @env EXAMPLE_COOKIES Cookie信息，格式：cookie@备注&cookie@备注
 * @env EXAMPLE_DELAY 账号间隔时间（毫秒），默认3000
 * @cron 0 9 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class ExampleCheckin {
    constructor() {
        this.name = '示例平台签到';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('EXAMPLE_DELAY', '3000'));
        
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
     * @returns {Array} 账号数组
     */
    getAccounts() {
        const accounts = [];
        
        // 优先使用ACCOUNTS环境变量（用户名密码方式）
        const accountsEnv = CommonUtils.getEnv('EXAMPLE_ACCOUNTS');
        if (accountsEnv) {
            const accountList = accountsEnv.split('&');
            accountList.forEach((account, index) => {
                const [credentials, remark] = account.split('@');
                const [username, password] = credentials.split(':');
                if (username && password) {
                    accounts.push({
                        username,
                        password,
                        remark: remark || `账号${index + 1}`,
                        type: 'password'
                    });
                }
            });
        }
        
        // 如果没有账号密码，则使用COOKIES环境变量
        if (accounts.length === 0) {
            const cookiesEnv = CommonUtils.getEnv('EXAMPLE_COOKIES');
            if (cookiesEnv) {
                const cookieList = cookiesEnv.split('&');
                cookieList.forEach((cookie, index) => {
                    const [cookieValue, remark] = cookie.split('@');
                    if (cookieValue) {
                        accounts.push({
                            cookie: cookieValue,
                            remark: remark || `账号${index + 1}`,
                            type: 'cookie'
                        });
                    }
                });
            }
        }

        if (accounts.length === 0) {
            CommonUtils.error('未获取到有效账号，请检查环境变量配置');
            CommonUtils.log('环境变量格式说明：');
            CommonUtils.log('EXAMPLE_ACCOUNTS="用户名:密码@备注&用户名:密码@备注"');
            CommonUtils.log('EXAMPLE_COOKIES="cookie@备注&cookie@备注"');
        }

        return accounts;
    }

    /**
     * 获取通知配置
     * @returns {Object} 通知配置
     */
    getNotifyConfig() {
        return {
            enabled: CommonUtils.getEnv('NOTIFY_ENABLED', 'true') === 'true',
            title: this.name,
            bark: {
                enabled: !!CommonUtils.getEnv('BARK_KEY'),
                key: CommonUtils.getEnv('BARK_KEY'),
                url: CommonUtils.getEnv('BARK_URL', 'https://api.day.app')
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
     * 模拟登录
     * @param {Object} account 账号信息
     * @returns {Object} 登录结果
     */
    async login(account) {
        try {
            if (account.type === 'password') {
                // 用户名密码登录方式
                CommonUtils.log(`[${account.remark}] 开始用户名密码登录`);
                
                // 模拟登录请求
                const loginData = {
                    username: account.username,
                    password: CommonUtils.md5(account.password), // 通常需要加密
                    timestamp: CommonUtils.timestamp()
                };

                // 这里替换为实际的登录接口
                const response = await this.request({
                    url: 'https://example.com/api/login',
                    method: 'POST',
                    data: loginData
                });

                if (response && response.code === 200) {
                    CommonUtils.success(`[${account.remark}] 登录成功`);
                    return {
                        success: true,
                        token: response.data.token,
                        userId: response.data.userId
                    };
                } else {
                    throw new Error(response?.message || '登录失败');
                }
            } else {
                // Cookie登录方式
                CommonUtils.log(`[${account.remark}] 使用Cookie登录`);
                
                // 验证Cookie有效性
                const response = await this.request({
                    url: 'https://example.com/api/userinfo',
                    method: 'GET',
                    headers: {
                        'Cookie': account.cookie
                    }
                });

                if (response && response.code === 200) {
                    CommonUtils.success(`[${account.remark}] Cookie验证成功`);
                    return {
                        success: true,
                        userId: response.data.userId,
                        cookie: account.cookie
                    };
                } else {
                    throw new Error('Cookie已失效');
                }
            }
        } catch (error) {
            CommonUtils.error(`[${account.remark}] 登录失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * 执行签到
     * @param {Object} account 账号信息
     * @param {Object} loginResult 登录结果
     * @returns {Object} 签到结果
     */
    async doCheckin(account, loginResult) {
        try {
            CommonUtils.log(`[${account.remark}] 开始执行签到`);

            const headers = {};
            if (loginResult.token) {
                headers['Authorization'] = `Bearer ${loginResult.token}`;
            } else if (loginResult.cookie) {
                headers['Cookie'] = loginResult.cookie;
            }

            // 执行签到请求
            const response = await this.request({
                url: 'https://example.com/api/checkin',
                method: 'POST',
                headers,
                data: {
                    userId: loginResult.userId,
                    timestamp: CommonUtils.timestamp()
                }
            });

            if (response && response.code === 200) {
                const reward = response.data.reward || '未知奖励';
                const days = response.data.continuousDays || 0;
                
                CommonUtils.success(`[${account.remark}] 签到成功`);
                CommonUtils.log(`[${account.remark}] 获得奖励: ${reward}`);
                CommonUtils.log(`[${account.remark}] 连续签到: ${days}天`);
                
                return {
                    success: true,
                    reward,
                    days,
                    message: `签到成功，获得${reward}，连续签到${days}天`
                };
            } else if (response && response.code === 1001) {
                // 已经签到过了
                CommonUtils.log(`[${account.remark}] 今日已签到`);
                return {
                    success: true,
                    message: '今日已签到',
                    alreadyChecked: true
                };
            } else {
                throw new Error(response?.message || '签到失败');
            }
        } catch (error) {
            CommonUtils.error(`[${account.remark}] 签到失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * 发送HTTP请求
     * @param {Object} options 请求选项
     * @returns {Object} 响应数据
     */
    async request(options) {
        const config = {
            timeout: 30000,
            headers: {
                'User-Agent': CommonUtils.getEnv('USER_AGENT', 
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
                ),
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
            } else if (error.request) {
                throw new Error('请求超时或网络错误');
            } else {
                throw new Error(error.message);
            }
        }
    }

    /**
     * 处理单个账号
     * @param {Object} account 账号信息
     * @param {number} index 账号索引
     */
    async processAccount(account, index) {
        CommonUtils.log(`\n========== 处理第${index + 1}个账号: ${account.remark} ==========`);
        
        try {
            // 登录
            const loginResult = await this.login(account);
            if (!loginResult.success) {
                this.results.failed++;
                this.results.details.push({
                    account: account.remark,
                    status: 'failed',
                    error: loginResult.error
                });
                return;
            }

            // 签到
            const checkinResult = await this.doCheckin(account, loginResult);
            if (checkinResult.success) {
                this.results.success++;
                this.results.details.push({
                    account: account.remark,
                    status: 'success',
                    message: checkinResult.message,
                    reward: checkinResult.reward,
                    days: checkinResult.days,
                    alreadyChecked: checkinResult.alreadyChecked
                });
            } else {
                this.results.failed++;
                this.results.details.push({
                    account: account.remark,
                    status: 'failed',
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
     * @returns {string} 结果报告
     */
    generateReport() {
        let report = `📊 ${this.name} 执行结果\n\n`;
        report += `🎯 总账号数: ${this.results.total}\n`;
        report += `✅ 成功: ${this.results.success}\n`;
        report += `❌ 失败: ${this.results.failed}\n\n`;

        // 详细结果
        this.results.details.forEach((detail, index) => {
            report += `${index + 1}. ${detail.account}: `;
            if (detail.status === 'success') {
                if (detail.alreadyChecked) {
                    report += `✅ 今日已签到\n`;
                } else {
                    report += `✅ ${detail.message}\n`;
                }
            } else {
                report += `❌ ${detail.error}\n`;
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
    new ExampleCheckin().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = ExampleCheckin;