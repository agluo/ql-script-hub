/**
 * 夸克网盘签到脚本
 * 
 * @name 夸克网盘签到
 * @description 自动完成夸克网盘每日签到，获取储存空间和会员积分奖励
 * @author agluo
 * @version 1.0.0
 * @env QUARK_COOKIES Cookie信息，格式：cookie@备注&cookie@备注
 * @env QUARK_DELAY 请求间隔时间（毫秒），默认3000
 * @cron 0 9 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class QuarkCheckin {
    constructor() {
        this.name = '夸克网盘签到';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('QUARK_DELAY', '3000'));
        
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
        
        const cookiesEnv = CommonUtils.getEnv('QUARK_COOKIES');
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
            CommonUtils.log('环境变量格式：QUARK_COOKIES="cookie@备注&cookie@备注"');
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
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
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
                url: 'https://drive.quark.cn/1/clouddrive/capacity/growth/info',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://pan.quark.cn/'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.status === 200 && data.data) {
                    const userInfo = data.data;
                    return {
                        success: true,
                        data: {
                            username: userInfo.nickname || '夸克用户',
                            totalStorage: this.formatStorage(userInfo.cap_total || 0),
                            usedStorage: this.formatStorage(userInfo.cap_used || 0),
                            growthStorage: this.formatStorage(userInfo.cap_growth || 0),
                            level: userInfo.level || 1
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
     * 格式化存储空间大小
     */
    formatStorage(bytes) {
        if (bytes === 0) return '0B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
    }

    /**
     * 获取签到信息
     */
    async getCheckinInfo(account) {
        try {
            const response = await this.request({
                url: 'https://drive.quark.cn/1/clouddrive/capacity/growth/sign/info',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://pan.quark.cn/'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.status === 200 && data.data) {
                    const signInfo = data.data;
                    return {
                        success: true,
                        data: {
                            signed: signInfo.sign_daily || false,
                            continueDays: signInfo.sign_daily_continuous_days || 0,
                            rewardSize: signInfo.sign_reward || 0
                        }
                    };
                } else {
                    throw new Error('获取签到信息失败');
                }
            } else {
                throw new Error(response.error || '获取签到信息失败');
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
                url: 'https://drive.quark.cn/1/clouddrive/capacity/growth/sign',
                method: 'POST',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://pan.quark.cn/',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                data: {}
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.status === 200) {
                    const rewardInfo = data.data || {};
                    return {
                        success: true,
                        message: '签到成功',
                        reward: this.formatStorage(rewardInfo.sign_daily_reward || 0),
                        continueDays: rewardInfo.sign_daily_continuous_days || 0
                    };
                } else if (data.status === 400 && data.message && data.message.includes('已签到')) {
                    return {
                        success: true,
                        message: '今日已签到',
                        alreadySigned: true
                    };
                } else {
                    throw new Error(data.message || '签到失败');
                }
            } else {
                throw new Error(response.error || '签到请求失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取会员信息
     */
    async getMemberInfo(account) {
        try {
            const response = await this.request({
                url: 'https://drive.quark.cn/1/clouddrive/member/info',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://pan.quark.cn/'
                }
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.status === 200 && data.data) {
                    const memberInfo = data.data;
                    return {
                        success: true,
                        data: {
                            isVip: memberInfo.member_type > 0,
                            memberType: memberInfo.member_type_name || '普通用户',
                            expireTime: memberInfo.member_expire_at ? 
                                       new Date(memberInfo.member_expire_at * 1000).toLocaleDateString() : '无',
                            points: memberInfo.points || 0
                        }
                    };
                }
            }
            return { success: false };
        } catch (error) {
            return { success: false };
        }
    }

    /**
     * 执行会员签到
     */
    async doMemberCheckin(account) {
        try {
            const response = await this.request({
                url: 'https://drive.quark.cn/1/clouddrive/member/sign',
                method: 'POST',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://pan.quark.cn/',
                    'Content-Type': 'application/json'
                },
                data: {}
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.status === 200) {
                    const rewardInfo = data.data || {};
                    return {
                        success: true,
                        message: '会员签到成功',
                        points: rewardInfo.sign_daily_reward || 0
                    };
                } else if (data.message && data.message.includes('已签到')) {
                    return {
                        success: true,
                        message: '会员今日已签到',
                        alreadySigned: true
                    };
                } else {
                    return { success: false, error: data.message || '会员签到失败' };
                }
            } else {
                return { success: false, error: response.error || '会员签到请求失败' };
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
            CommonUtils.log(`[${account.remark}] 总容量: ${userInfo.data.totalStorage}`);
            CommonUtils.log(`[${account.remark}] 已用: ${userInfo.data.usedStorage}`);
            CommonUtils.log(`[${account.remark}] 成长空间: ${userInfo.data.growthStorage}`);

            // 获取签到信息
            const checkinInfo = await this.getCheckinInfo(account);
            let alreadySigned = false;
            let continueDays = 0;
            
            if (checkinInfo.success) {
                alreadySigned = checkinInfo.data.signed;
                continueDays = checkinInfo.data.continueDays;
                CommonUtils.log(`[${account.remark}] 连续签到: ${continueDays}天`);
            }

            let checkinResult = { success: true, message: '今日已签到', alreadySigned: true };
            
            // 如果未签到，执行签到
            if (!alreadySigned) {
                checkinResult = await this.doCheckin(account);
            }

            // 获取会员信息并尝试会员签到
            let memberResult = null;
            const memberInfo = await this.getMemberInfo(account);
            if (memberInfo.success) {
                CommonUtils.log(`[${account.remark}] 会员类型: ${memberInfo.data.memberType}`);
                CommonUtils.log(`[${account.remark}] 会员积分: ${memberInfo.data.points}`);
                
                if (memberInfo.data.isVip) {
                    memberResult = await this.doMemberCheckin(account);
                }
            }

            // 处理签到结果
            if (checkinResult.success) {
                if (checkinResult.alreadySigned) {
                    CommonUtils.log(`[${account.remark}] ${checkinResult.message}`);
                } else {
                    const reward = checkinResult.reward ? ` (${checkinResult.reward})` : '';
                    CommonUtils.success(`[${account.remark}] ${checkinResult.message}${reward}`);
                }
                
                // 处理会员签到结果
                let memberMessage = '';
                if (memberResult) {
                    if (memberResult.success) {
                        if (memberResult.alreadySigned) {
                            CommonUtils.log(`[${account.remark}] ${memberResult.message}`);
                            memberMessage = memberResult.message;
                        } else {
                            const points = memberResult.points ? ` (+${memberResult.points}积分)` : '';
                            CommonUtils.success(`[${account.remark}] ${memberResult.message}${points}`);
                            memberMessage = `${memberResult.message}${points}`;
                        }
                    } else {
                        CommonUtils.warn(`[${account.remark}] 会员签到失败: ${memberResult.error}`);
                        memberMessage = `会员签到失败: ${memberResult.error}`;
                    }
                }
                
                this.results.success++;
                this.results.details.push({
                    account: account.remark,
                    status: 'success',
                    user: userInfo.data.username,
                    totalStorage: userInfo.data.totalStorage,
                    usedStorage: userInfo.data.usedStorage,
                    growthStorage: userInfo.data.growthStorage,
                    level: userInfo.data.level,
                    message: checkinResult.message,
                    reward: checkinResult.reward || '',
                    continueDays: checkinResult.continueDays || continueDays,
                    alreadySigned: checkinResult.alreadySigned || false,
                    memberType: memberInfo.success ? memberInfo.data.memberType : '普通用户',
                    memberPoints: memberInfo.success ? memberInfo.data.points : 0,
                    memberMessage: memberMessage
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
                
                if (detail.totalStorage) {
                    report += `   💾 总容量: ${detail.totalStorage} | 已用: ${detail.usedStorage}\n`;
                }
                if (detail.continueDays > 0) {
                    report += `   📅 连续签到: ${detail.continueDays}天\n`;
                }
                if (detail.memberType && detail.memberType !== '普通用户') {
                    report += `   👑 会员: ${detail.memberType}`;
                    if (detail.memberPoints > 0) {
                        report += ` (${detail.memberPoints}积分)`;
                    }
                    report += '\n';
                }
                if (detail.memberMessage) {
                    report += `   🎁 ${detail.memberMessage}\n`;
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
    new QuarkCheckin().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = QuarkCheckin;