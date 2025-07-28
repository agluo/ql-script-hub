/**
 * 恩山无线论坛签到脚本
 * 
 * @name 恩山论坛签到
 * @description 自动完成恩山无线论坛每日签到，获取恩山币奖励
 * @author agluo
 * @version 1.0.0
 * @env ENSHAN_COOKIES Cookie信息，格式：cookie@备注&cookie@备注
 * @env ENSHAN_DELAY 请求间隔时间（毫秒），默认3000
 * @cron 0 8 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class EnshanCheckin {
    constructor() {
        this.name = '恩山论坛签到';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('ENSHAN_DELAY', '3000'));
        
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
        
        const cookiesEnv = CommonUtils.getEnv('ENSHAN_COOKIES');
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
            CommonUtils.log('环境变量格式：ENSHAN_COOKIES="cookie@备注&cookie@备注"');
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
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
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
     * 获取用户信息
     */
    async getUserInfo(account) {
        try {
            const response = await this.request({
                url: 'https://www.right.com.cn/forum/home.php?mod=space&do=profile',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.right.com.cn/forum/'
                }
            });

            if (response.success && response.data) {
                const html = response.data;
                
                // 检查是否已登录
                if (html.includes('未登录') || html.includes('login') || html.includes('您需要先登录')) {
                    throw new Error('Cookie已失效，请重新获取');
                }

                // 提取用户名
                let username = '未知用户';
                const usernameMatch = html.match(/<h2[^>]*class="mt"[^>]*>([^<]+)<\/h2>/) || 
                                    html.match(/用户名[:：]\s*([^<\n]+)/i) ||
                                    html.match(/<title>([^-<]+)/);
                if (usernameMatch) {
                    username = usernameMatch[1].trim();
                }

                // 提取用户组
                let userGroup = '普通会员';
                const groupMatch = html.match(/用户组[:：]\s*([^<\n]+)/i) || 
                                 html.match(/<em[^>]*>([^<]*会员[^<]*)<\/em>/i);
                if (groupMatch) {
                    userGroup = groupMatch[1].trim();
                }

                // 提取恩山币
                let coins = '0';
                const coinsMatch = html.match(/恩山币[:：]\s*(\d+)/i) || 
                                 html.match(/积分[:：]\s*(\d+)/i) ||
                                 html.match(/金币[:：]\s*(\d+)/i);
                if (coinsMatch) {
                    coins = coinsMatch[1].trim();
                }

                // 提取注册时间
                let regTime = '未知';
                const regMatch = html.match(/注册时间[:：]\s*([^<\n]+)/i);
                if (regMatch) {
                    regTime = regMatch[1].trim();
                }

                return {
                    success: true,
                    data: {
                        username,
                        userGroup,
                        coins,
                        regTime
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
     * 获取签到页面信息
     */
    async getCheckinPage(account) {
        try {
            const response = await this.request({
                url: 'https://www.right.com.cn/forum/plugin.php?id=dsu_paulsign:sign',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.right.com.cn/forum/'
                }
            });

            if (response.success && response.data) {
                const html = response.data;
                
                // 检查是否已签到
                if (html.includes('已经签到') || html.includes('您今天已经签到过了')) {
                    return {
                        success: true,
                        alreadySigned: true,
                        message: '今日已签到'
                    };
                }

                // 提取签到必要参数
                const formhashMatch = html.match(/name="formhash"\s+value="([^"]+)"/);
                const signhashMatch = html.match(/name="signhash"\s+value="([^"]+)"/);
                
                if (!formhashMatch) {
                    throw new Error('未找到formhash参数');
                }

                return {
                    success: true,
                    alreadySigned: false,
                    formhash: formhashMatch[1],
                    signhash: signhashMatch ? signhashMatch[1] : ''
                };
            } else {
                throw new Error('获取签到页面失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 执行签到
     */
    async doCheckin(account, formhash, signhash = '') {
        try {
            // 构建签到参数
            const formData = new URLSearchParams();
            formData.append('formhash', formhash);
            formData.append('signsubmit', 'apply');
            if (signhash) {
                formData.append('signhash', signhash);
            }

            const response = await this.request({
                url: 'https://www.right.com.cn/forum/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
                method: 'POST',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.right.com.cn/forum/plugin.php?id=dsu_paulsign:sign',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                data: formData.toString()
            });

            if (response.success && response.data) {
                const html = response.data;
                
                // 签到成功
                if (html.includes('签到成功') || html.includes('恭喜您签到成功')) {
                    // 提取奖励信息
                    const reward = this.extractReward(html);
                    return {
                        success: true,
                        message: '签到成功',
                        reward: reward
                    };
                }
                // 已经签到
                else if (html.includes('已经签到') || html.includes('您今天已经签到过了')) {
                    return {
                        success: true,
                        message: '今日已签到',
                        alreadySigned: true
                    };
                }
                // 签到失败
                else {
                    throw new Error('签到失败，可能需要验证码或其他验证');
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
    extractReward(html) {
        if (!html) return '';
        
        // 匹配恩山币奖励
        const coinsMatch = html.match(/获得了?\s*(\d+)\s*恩山币/i) || 
                          html.match(/恩山币\s*\+(\d+)/i) ||
                          html.match(/积分\s*\+(\d+)/i);
        if (coinsMatch) {
            return `+${coinsMatch[1]}恩山币`;
        }

        // 匹配其他奖励信息
        const rewardMatch = html.match(/获得了?\s*([^，。！<]+)/);
        if (rewardMatch) {
            return rewardMatch[1].trim();
        }

        return '';
    }

    /**
     * 获取签到排行榜信息
     */
    async getCheckinRank(account) {
        try {
            const response = await this.request({
                url: 'https://www.right.com.cn/forum/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.right.com.cn/forum/'
                }
            });

            if (response.success && response.data) {
                const html = response.data;
                
                // 提取今日签到人数
                const todayCountMatch = html.match(/今日签到人数[：:]\s*(\d+)/i);
                const todayCount = todayCountMatch ? todayCountMatch[1] : '0';

                // 提取累计签到天数
                let continueDays = '0';
                const continueMatch = html.match(/连续签到\s*(\d+)\s*天/i) || 
                                    html.match(/累计签到\s*(\d+)\s*天/i);
                if (continueMatch) {
                    continueDays = continueMatch[1];
                }

                return {
                    success: true,
                    todayCount,
                    continueDays
                };
            }
        } catch (error) {
            // 获取排行榜信息失败不影响主流程
            return { success: false };
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
            CommonUtils.log(`[${account.remark}] 用户组: ${userInfo.data.userGroup}`);
            CommonUtils.log(`[${account.remark}] 恩山币: ${userInfo.data.coins}`);

            // 获取签到页面信息
            const checkinPageInfo = await this.getCheckinPage(account);
            if (!checkinPageInfo.success) {
                this.results.failed++;
                this.results.details.push({
                    account: account.remark,
                    status: 'failed',
                    user: userInfo.data.username,
                    error: checkinPageInfo.error
                });
                return;
            }

            // 如果已经签到
            if (checkinPageInfo.alreadySigned) {
                CommonUtils.log(`[${account.remark}] ${checkinPageInfo.message}`);
                
                // 获取签到统计信息
                const rankInfo = await this.getCheckinRank(account);
                
                this.results.success++;
                this.results.details.push({
                    account: account.remark,
                    status: 'success',
                    user: userInfo.data.username,
                    userGroup: userInfo.data.userGroup,
                    coins: userInfo.data.coins,
                    message: checkinPageInfo.message,
                    alreadySigned: true,
                    todayCount: rankInfo.success ? rankInfo.todayCount : '未知',
                    continueDays: rankInfo.success ? rankInfo.continueDays : '未知'
                });
                return;
            }

            // 执行签到
            const checkinResult = await this.doCheckin(account, checkinPageInfo.formhash, checkinPageInfo.signhash);
            if (checkinResult.success) {
                if (checkinResult.alreadySigned) {
                    CommonUtils.log(`[${account.remark}] ${checkinResult.message}`);
                } else {
                    const reward = checkinResult.reward ? ` (${checkinResult.reward})` : '';
                    CommonUtils.success(`[${account.remark}] ${checkinResult.message}${reward}`);
                }
                
                // 获取签到统计信息
                const rankInfo = await this.getCheckinRank(account);
                
                this.results.success++;
                this.results.details.push({
                    account: account.remark,
                    status: 'success',
                    user: userInfo.data.username,
                    userGroup: userInfo.data.userGroup,
                    coins: userInfo.data.coins,
                    message: checkinResult.message,
                    reward: checkinResult.reward || '',
                    alreadySigned: checkinResult.alreadySigned || false,
                    todayCount: rankInfo.success ? rankInfo.todayCount : '未知',
                    continueDays: rankInfo.success ? rankInfo.continueDays : '未知'
                });
            } else {
                CommonUtils.error(`[${account.remark}] 签到失败: ${checkinResult.error}`);
                this.results.failed++;
                this.results.details.push({
                    account: account.remark,
                    status: 'failed',
                    user: userInfo.data.username,
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
                
                if (detail.coins) {
                    report += `   💰 恩山币: ${detail.coins}\n`;
                }
                if (detail.continueDays && detail.continueDays !== '未知') {
                    report += `   📅 连续签到: ${detail.continueDays}天\n`;
                }
                if (detail.todayCount && detail.todayCount !== '未知') {
                    report += `   👥 今日签到: ${detail.todayCount}人\n`;
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
    new EnshanCheckin().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = EnshanCheckin;