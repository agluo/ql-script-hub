/**
 * 百度贴吧签到脚本
 * 
 * @name 百度贴吧签到
 * @description 自动完成百度贴吧关注的所有贴吧签到，获取经验值
 * @author agluo
 * @version 1.0.0
 * @env TIEBA_COOKIES Cookie信息，格式：cookie@备注&cookie@备注
 * @env TIEBA_DELAY 贴吧间隔时间（毫秒），默认2000
 * @env TIEBA_MAX_BARS 每个账号最大签到贴吧数，默认50
 * @cron 0 9 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class TiebaCheckin {
    constructor() {
        this.name = '百度贴吧签到';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('TIEBA_DELAY', '2000'));
        this.maxBars = parseInt(CommonUtils.getEnv('TIEBA_MAX_BARS', '50'));
        
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
        
        const cookiesEnv = CommonUtils.getEnv('TIEBA_COOKIES');
        if (cookiesEnv) {
            const cookieList = cookiesEnv.split('&');
            cookieList.forEach((cookie, index) => {
                const [cookieValue, remark] = cookie.split('@');
                if (cookieValue) {
                    accounts.push({
                        cookie: cookieValue,
                        remark: remark || `账号${index + 1}`
                    });
                }
            });
        }

        if (accounts.length === 0) {
            CommonUtils.error('未获取到有效账号，请检查环境变量配置');
            CommonUtils.log('环境变量格式：TIEBA_COOKIES="cookie@备注&cookie@备注"');
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
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await axios(config);
            return {
                success: true,
                data: response.data,
                status: response.status
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
     * 获取用户信息
     */
    async getUserInfo(account) {
        try {
            const response = await this.request({
                url: 'https://tieba.baidu.com/mo/q/newmoindex',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://tieba.baidu.com/'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.no === 0) {
                    return {
                        success: true,
                        data: {
                            username: data.data.user.name || '未知用户',
                            levelId: data.data.user.levelId || 0,
                            tbs: data.data.tbs || ''
                        }
                    };
                } else {
                    throw new Error('Cookie已失效或账号异常');
                }
            } else {
                throw new Error(response.error || '获取用户信息失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取关注的贴吧列表
     */
    async getFollowedBars(account, tbs) {
        try {
            const response = await this.request({
                url: 'https://tieba.baidu.com/mo/q/newmoindex',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://tieba.baidu.com/'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.no === 0 && data.data.like_forum) {
                    const forums = data.data.like_forum.slice(0, this.maxBars);
                    return {
                        success: true,
                        forums: forums.map(forum => ({
                            name: forum.forum_name,
                            id: forum.forum_id,
                            level: forum.user_level || 0,
                            exp: forum.user_exp || 0
                        }))
                    };
                } else {
                    return { success: true, forums: [] };
                }
            } else {
                throw new Error(response.error || '获取贴吧列表失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 单个贴吧签到
     */
    async signBar(account, bar, tbs) {
        try {
            const formData = new URLSearchParams();
            formData.append('kw', bar.name);
            formData.append('tbs', tbs);
            formData.append('ie', 'utf-8');

            const response = await this.request({
                url: 'https://tieba.baidu.com/sign/add',
                method: 'POST',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': `https://tieba.baidu.com/f?kw=${encodeURIComponent(bar.name)}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                data: formData.toString()
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.no === 0) {
                    const userInfo = data.data.uinfo || {};
                    const signBonus = data.data.signBonus || {};
                    
                    return {
                        success: true,
                        exp: signBonus.signExp || 0,
                        continueDays: signBonus.contSignNum || 0,
                        currentLevel: userInfo.user_sign_rank || bar.level,
                        message: `签到成功，获得${signBonus.signExp || 0}经验`
                    };
                } else if (data.no === 1101) {
                    return {
                        success: true,
                        exp: 0,
                        message: '今日已签到',
                        alreadySigned: true
                    };
                } else if (data.no === 1102) {
                    return {
                        success: false,
                        error: '需要验证码，请手动签到一次'
                    };
                } else {
                    throw new Error(data.error || `签到失败，错误码：${data.no}`);
                }
            } else {
                throw new Error(response.error || '签到请求失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 处理单个账号
     */
    async processAccount(account, index) {
        CommonUtils.log(`\n========== 处理第${index + 1}个账号: ${account.remark} ==========`);
        
        try {
            // 获取用户信息
            const userInfo = await this.getUserInfo(account);
            if (!userInfo.success) {
                this.results.failed++;
                this.results.details.push({
                    account: account.remark,
                    status: 'failed',
                    error: userInfo.error
                });
                return;
            }

            CommonUtils.log(`[${account.remark}] 用户: ${userInfo.data.username}`);
            CommonUtils.log(`[${account.remark}] 等级: ${userInfo.data.levelId}`);

            // 获取关注的贴吧列表
            const barsResult = await this.getFollowedBars(account, userInfo.data.tbs);
            if (!barsResult.success) {
                this.results.failed++;
                this.results.details.push({
                    account: account.remark,
                    status: 'failed',
                    error: barsResult.error
                });
                return;
            }

            const forums = barsResult.forums;
            CommonUtils.log(`[${account.remark}] 发现 ${forums.length} 个关注的贴吧`);

            if (forums.length === 0) {
                this.results.success++;
                this.results.details.push({
                    account: account.remark,
                    status: 'success',
                    user: userInfo.data.username,
                    level: userInfo.data.levelId,
                    signedCount: 0,
                    failedCount: 0,
                    totalBars: 0,
                    message: '没有关注的贴吧'
                });
                return;
            }

            let signedCount = 0;
            let failedCount = 0;
            let totalExp = 0;
            const signDetails = [];

            // 依次签到每个贴吧
            for (let i = 0; i < forums.length; i++) {
                const bar = forums[i];
                const signResult = await this.signBar(account, bar, userInfo.data.tbs);
                
                if (signResult.success) {
                    if (signResult.alreadySigned) {
                        CommonUtils.log(`[${account.remark}] ${bar.name}: 今日已签到`);
                    } else {
                        signedCount++;
                        totalExp += signResult.exp;
                        CommonUtils.success(`[${account.remark}] ${bar.name}: ${signResult.message}`);
                    }
                    
                    signDetails.push({
                        name: bar.name,
                        status: 'success',
                        exp: signResult.exp,
                        alreadySigned: signResult.alreadySigned
                    });
                } else {
                    failedCount++;
                    CommonUtils.error(`[${account.remark}] ${bar.name}: ${signResult.error}`);
                    signDetails.push({
                        name: bar.name,
                        status: 'failed',
                        error: signResult.error
                    });
                }

                // 贴吧间延时
                if (i < forums.length - 1) {
                    await CommonUtils.randomWait(this.delay, this.delay + 1000);
                }
            }

            this.results.success++;
            this.results.details.push({
                account: account.remark,
                status: 'success',
                user: userInfo.data.username,
                level: userInfo.data.levelId,
                signedCount,
                failedCount,
                totalBars: forums.length,
                totalExp,
                signDetails
            });

            CommonUtils.success(`[${account.remark}] 签到完成: 成功${signedCount}个，失败${failedCount}个，总获得${totalExp}经验`);

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
            CommonUtils.log(`等待 ${this.delay * 2}ms 后处理下一个账号...`);
            await CommonUtils.wait(this.delay * 2);
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
                if (detail.totalBars === 0) {
                    report += `   📝 ${detail.message}\n`;
                } else {
                    report += `   ✅ 签到: ${detail.signedCount}/${detail.totalBars}个贴吧`;
                    if (detail.totalExp > 0) {
                        report += ` (+${detail.totalExp}经验)`;
                    }
                    if (detail.failedCount > 0) {
                        report += ` | 失败${detail.failedCount}个`;
                    }
                    report += '\n';
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
    new TiebaCheckin().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = TiebaCheckin;