/**
 * 爱奇艺签到脚本
 * 
 * @name 爱奇艺签到
 * @description 自动完成爱奇艺VIP签到任务，获取VIP成长值
 * @author agluo
 * @version 1.0.0
 * @env IQIYI_COOKIES Cookie信息，格式：cookie@备注&cookie@备注
 * @env IQIYI_DELAY 账号间隔时间（毫秒），默认3000
 * @cron 0 9 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class IqiyiCheckin {
    constructor() {
        this.name = '爱奇艺签到';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('IQIYI_DELAY', '3000'));
        
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
        
        const cookiesEnv = CommonUtils.getEnv('IQIYI_COOKIES');
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
            CommonUtils.log('环境变量格式：IQIYI_COOKIES="cookie@备注&cookie@备注"');
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
                url: 'https://serv.vip.iqiyi.com/vipgrowth/query.action',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.iqiyi.com/'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.code === 'A00000') {
                    return {
                        success: true,
                        data: {
                            level: data.data.level || 0,
                            todayGrowthValue: data.data.todayGrowthValue || 0,
                            growthvalue: data.data.growthvalue || 0,
                            distance: data.data.distance || 0
                        }
                    };
                } else {
                    throw new Error(data.msg || '获取用户信息失败');
                }
            } else {
                throw new Error(response.error || '请求失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 执行签到
     */
    async doCheckin(account) {
        try {
            const response = await this.request({
                url: 'https://serv.vip.iqiyi.com/vipgrowth/sign.action',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.iqiyi.com/'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.code === 'A00000') {
                    const growthValue = data.data.growthValue || 0;
                    return {
                        success: true,
                        growthValue,
                        message: `签到成功，获得${growthValue}成长值`
                    };
                } else if (data.code === 'A00001') {
                    return {
                        success: true,
                        growthValue: 0,
                        message: '今日已签到',
                        alreadyChecked: true
                    };
                } else {
                    throw new Error(data.msg || '签到失败');
                }
            } else {
                throw new Error(response.error || '请求失败');
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

            CommonUtils.log(`[${account.remark}] VIP等级: ${userInfo.data.level}`);
            CommonUtils.log(`[${account.remark}] 当前成长值: ${userInfo.data.growthvalue}`);
            CommonUtils.log(`[${account.remark}] 距离下一级: ${userInfo.data.distance}`);

            // 执行签到
            const checkinResult = await this.doCheckin(account);
            if (checkinResult.success) {
                this.results.success++;
                this.results.details.push({
                    account: account.remark,
                    status: 'success',
                    message: checkinResult.message,
                    growthValue: checkinResult.growthValue,
                    level: userInfo.data.level,
                    totalGrowthValue: userInfo.data.growthvalue,
                    alreadyChecked: checkinResult.alreadyChecked
                });

                CommonUtils.success(`[${account.remark}] ${checkinResult.message}`);
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
                    report += `✅ 今日已签到 (VIP${detail.level}级)\n`;
                } else {
                    report += `✅ ${detail.message} (VIP${detail.level}级)\n`;
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
    new IqiyiCheckin().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = IqiyiCheckin;