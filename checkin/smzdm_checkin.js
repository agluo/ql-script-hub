/**
 * 什么值得买签到脚本
 * 
 * @name 什么值得买签到
 * @description 自动完成什么值得买签到任务，获取积分和碎银子
 * @author agluo
 * @version 1.0.0
 * @env SMZDM_COOKIES Cookie信息，格式：cookie@备注&cookie@备注
 * @env SMZDM_DELAY 账号间隔时间（毫秒），默认3000
 * @cron 0 9 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class SmzdmCheckin {
    constructor() {
        this.name = '什么值得买签到';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('SMZDM_DELAY', '3000'));
        
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
        
        const cookiesEnv = CommonUtils.getEnv('SMZDM_COOKIES');
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
            CommonUtils.log('环境变量格式：SMZDM_COOKIES="cookie@备注&cookie@备注"');
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
                'User-Agent': 'smzdm_android_V10.4.6 rv:822 (MI 8;Android10;zh)smzdmapp',
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
                url: 'https://user-api.smzdm.com/user',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.smzdm.com/'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.error_code === 0) {
                    return {
                        success: true,
                        data: {
                            nickname: data.data.nickname || '未知用户',
                            level: data.data.level || 0,
                            points: data.data.points || 0,
                            silver: data.data.silver || 0,
                            gold: data.data.gold || 0
                        }
                    };
                } else {
                    throw new Error(data.error_msg || 'Cookie已失效');
                }
            } else {
                throw new Error(response.error || '获取用户信息失败');
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
                url: 'https://user-api.smzdm.com/checkin',
                method: 'POST',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.smzdm.com/',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.error_code === 0) {
                    const reward = data.data || {};
                    const points = reward.points || 0;
                    const silver = reward.silver || 0;
                    const continueDays = reward.continue_checkin_days || 0;
                    
                    return {
                        success: true,
                        points,
                        silver,
                        continueDays,
                        message: `签到成功，获得${points}积分，${silver}碎银子，连续签到${continueDays}天`
                    };
                } else if (data.error_code === 11) {
                    return {
                        success: true,
                        points: 0,
                        silver: 0,
                        message: '今日已签到',
                        alreadyChecked: true
                    };
                } else {
                    throw new Error(data.error_msg || '签到失败');
                }
            } else {
                throw new Error(response.error || '请求失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 每日转盘
     */
    async doWheelLottery(account) {
        try {
            // 先获取转盘信息
            const infoResponse = await this.request({
                url: 'https://zhiyou.smzdm.com/user/lottery/jsonp_get_lottery_info',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.smzdm.com/'
                }
            });

            if (!infoResponse.success || !infoResponse.data) {
                return { success: false, error: '获取转盘信息失败' };
            }

            const lotteryInfo = infoResponse.data.data;
            if (!lotteryInfo || lotteryInfo.remain_lottery_count <= 0) {
                return {
                    success: true,
                    message: '今日转盘次数已用完',
                    noChance: true
                };
            }

            // 执行转盘
            const lotteryResponse = await this.request({
                url: 'https://zhiyou.smzdm.com/user/lottery/jsonp_lottery',
                method: 'POST',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://www.smzdm.com/',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (lotteryResponse.success && lotteryResponse.data) {
                const data = lotteryResponse.data;
                if (data.error_code === 0) {
                    const prize = data.data.lottery_text || '未知奖品';
                    return {
                        success: true,
                        prize,
                        message: `转盘成功，获得：${prize}`
                    };
                } else {
                    throw new Error(data.error_msg || '转盘失败');
                }
            } else {
                throw new Error('转盘请求失败');
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

            CommonUtils.log(`[${account.remark}] 用户: ${userInfo.data.nickname}`);
            CommonUtils.log(`[${account.remark}] 等级: Lv.${userInfo.data.level}`);
            CommonUtils.log(`[${account.remark}] 积分: ${userInfo.data.points}`);
            CommonUtils.log(`[${account.remark}] 碎银子: ${userInfo.data.silver}`);

            let accountResult = {
                account: account.remark,
                status: 'success',
                user: userInfo.data.nickname,
                level: userInfo.data.level,
                points: userInfo.data.points,
                silver: userInfo.data.silver
            };

            // 执行签到
            const checkinResult = await this.doCheckin(account);
            if (checkinResult.success) {
                CommonUtils.success(`[${account.remark}] ${checkinResult.message}`);
                accountResult.checkinMessage = checkinResult.message;
                accountResult.checkinPoints = checkinResult.points || 0;
                accountResult.checkinSilver = checkinResult.silver || 0;
                accountResult.continueDays = checkinResult.continueDays || 0;
                accountResult.alreadyChecked = checkinResult.alreadyChecked;
            } else {
                CommonUtils.error(`[${account.remark}] 签到失败: ${checkinResult.error}`);
                accountResult.checkinError = checkinResult.error;
            }

            // 等待一下再执行转盘
            await CommonUtils.randomWait(2000, 4000);

            // 执行转盘
            CommonUtils.log(`[${account.remark}] 开始转盘抽奖...`);
            const wheelResult = await this.doWheelLottery(account);
            if (wheelResult.success) {
                if (wheelResult.noChance) {
                    CommonUtils.log(`[${account.remark}] ${wheelResult.message}`);
                    accountResult.wheelMessage = wheelResult.message;
                } else {
                    CommonUtils.success(`[${account.remark}] ${wheelResult.message}`);
                    accountResult.wheelMessage = wheelResult.message;
                    accountResult.wheelPrize = wheelResult.prize;
                }
            } else {
                CommonUtils.error(`[${account.remark}] 转盘失败: ${wheelResult.error}`);
                accountResult.wheelError = wheelResult.error;
            }

            this.results.success++;
            this.results.details.push(accountResult);

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
                // 签到结果
                if (detail.alreadyChecked) {
                    report += `   ✅ 今日已签到`;
                } else if (detail.checkinPoints > 0 || detail.checkinSilver > 0) {
                    report += `   ✅ 签到: +${detail.checkinPoints}积分 +${detail.checkinSilver}碎银子`;
                    if (detail.continueDays > 0) {
                        report += ` (连续${detail.continueDays}天)`;
                    }
                } else if (detail.checkinError) {
                    report += `   ❌ 签到失败: ${detail.checkinError}`;
                }
                
                // 转盘结果
                if (detail.wheelPrize) {
                    report += `\n   🎰 转盘: ${detail.wheelPrize}`;
                } else if (detail.wheelMessage) {
                    report += `\n   🎰 转盘: ${detail.wheelMessage}`;
                } else if (detail.wheelError) {
                    report += `\n   ❌ 转盘失败: ${detail.wheelError}`;
                }
                
                report += `\n   📊 Lv.${detail.level} | ${detail.points}积分 | ${detail.silver}碎银子\n`;
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
    new SmzdmCheckin().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = SmzdmCheckin;