/**
 * 微博签到脚本
 * 
 * @name 微博签到
 * @description 自动完成微博签到任务，获取积分奖励
 * @author agluo
 * @version 1.0.0
 * @env WEIBO_COOKIES Cookie信息，格式：cookie@备注&cookie@备注
 * @env WEIBO_DELAY 账号间隔时间（毫秒），默认3000
 * @cron 0 9 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class WeiboCheckin {
    constructor() {
        this.name = '微博签到';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('WEIBO_DELAY', '3000'));
        
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
        
        const cookiesEnv = CommonUtils.getEnv('WEIBO_COOKIES');
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
            CommonUtils.log('环境变量格式：WEIBO_COOKIES="cookie@备注&cookie@备注"');
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
                url: 'https://m.weibo.cn/api/config',
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://m.weibo.cn/'
                }
            });

            if (response.success && response.data) {
                const data = response.data.data;
                if (data && data.login) {
                    return {
                        success: true,
                        data: {
                            uid: data.uid,
                            screen_name: data.screen_name || '未知用户',
                            followers_count: data.followers_count || 0,
                            statuses_count: data.statuses_count || 0
                        }
                    };
                } else {
                    throw new Error('Cookie已失效，请重新获取');
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
            // 微博签到接口
            const response = await this.request({
                url: 'https://m.weibo.cn/api/checkin',
                method: 'POST',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://m.weibo.cn/',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                data: 'st=' + this.extractSt(account.cookie)
            });

            if (response.success && response.data) {
                const data = response.data;
                if (data.ok === 1) {
                    const points = data.data?.points || 0;
                    const totalPoints = data.data?.total_points || 0;
                    return {
                        success: true,
                        points,
                        totalPoints,
                        message: `签到成功，获得${points}积分，总积分${totalPoints}`
                    };
                } else if (data.errno === 385001) {
                    return {
                        success: true,
                        points: 0,
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
     * 从Cookie中提取st参数
     */
    extractSt(cookie) {
        const match = cookie.match(/SUB=([^;]+)/);
        if (match) {
            return match[1];
        }
        return '';
    }

    /**
     * 超话签到
     */
    async doSuperTopicCheckin(account, userInfo) {
        const checkedTopics = [];
        const failedTopics = [];

        try {
            // 获取关注的超话列表
            const topicsResponse = await this.request({
                url: `https://m.weibo.cn/api/container/getIndex?containerid=100803_-_followsuper_-_${userInfo.data.uid}`,
                method: 'GET',
                headers: {
                    'Cookie': account.cookie,
                    'Referer': 'https://m.weibo.cn/'
                }
            });

            if (topicsResponse.success && topicsResponse.data && topicsResponse.data.data && topicsResponse.data.data.cards) {
                const topics = topicsResponse.data.data.cards.filter(card => card.card_type === 8);
                
                CommonUtils.log(`[${account.remark}] 发现 ${topics.length} 个关注的超话`);

                // 限制签到数量，避免请求过多
                const maxTopics = Math.min(topics.length, 10);
                
                for (let i = 0; i < maxTopics; i++) {
                    const topic = topics[i];
                    const topicName = topic.card_group[0].desc1 || '未知超话';
                    
                    try {
                        // 超话签到
                        const checkinResponse = await this.request({
                            url: 'https://m.weibo.cn/api/checkin/do',
                            method: 'POST',
                            headers: {
                                'Cookie': account.cookie,
                                'Referer': 'https://m.weibo.cn/',
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            data: `topic_id=${topic.card_group[0].desc2}&st=${this.extractSt(account.cookie)}`
                        });

                        if (checkinResponse.success && checkinResponse.data) {
                            if (checkinResponse.data.ok === 1) {
                                checkedTopics.push(topicName);
                                CommonUtils.success(`[${account.remark}] 超话签到成功: ${topicName}`);
                            } else if (checkinResponse.data.errno === 385001) {
                                CommonUtils.log(`[${account.remark}] 超话已签到: ${topicName}`);
                            } else {
                                failedTopics.push(topicName);
                                CommonUtils.error(`[${account.remark}] 超话签到失败: ${topicName} - ${checkinResponse.data.msg}`);
                            }
                        }
                    } catch (error) {
                        failedTopics.push(topicName);
                        CommonUtils.error(`[${account.remark}] 超话签到异常: ${topicName} - ${error.message}`);
                    }

                    // 超话间延时
                    await CommonUtils.randomWait(2000, 4000);
                }
            }
        } catch (error) {
            CommonUtils.error(`[${account.remark}] 获取超话列表失败: ${error.message}`);
        }

        return {
            checkedTopics,
            failedTopics,
            totalTopics: checkedTopics.length + failedTopics.length
        };
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

            CommonUtils.log(`[${account.remark}] 用户: ${userInfo.data.screen_name}`);
            CommonUtils.log(`[${account.remark}] 粉丝数: ${userInfo.data.followers_count}`);
            CommonUtils.log(`[${account.remark}] 微博数: ${userInfo.data.statuses_count}`);

            // 执行签到
            const checkinResult = await this.doCheckin(account);
            let accountResult = {
                account: account.remark,
                status: checkinResult.success ? 'success' : 'failed',
                user: userInfo.data.screen_name,
                followers: userInfo.data.followers_count
            };

            if (checkinResult.success) {
                CommonUtils.success(`[${account.remark}] ${checkinResult.message}`);
                accountResult.message = checkinResult.message;
                accountResult.points = checkinResult.points || 0;
                accountResult.totalPoints = checkinResult.totalPoints || 0;
                accountResult.alreadyChecked = checkinResult.alreadyChecked;

                // 超话签到
                CommonUtils.log(`[${account.remark}] 开始超话签到...`);
                const superTopicResult = await this.doSuperTopicCheckin(account, userInfo);
                accountResult.superTopics = superTopicResult;

                this.results.success++;
            } else {
                CommonUtils.error(`[${account.remark}] 签到失败: ${checkinResult.error}`);
                accountResult.error = checkinResult.error;
                this.results.failed++;
            }

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
            report += `: `;
            
            if (detail.status === 'success') {
                if (detail.alreadyChecked) {
                    report += `✅ 今日已签到`;
                } else {
                    report += `✅ 签到成功，获得${detail.points}积分`;
                }
                
                if (detail.superTopics && detail.superTopics.checkedTopics.length > 0) {
                    report += ` | 超话签到${detail.superTopics.checkedTopics.length}个`;
                }
                report += '\n';
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
    new WeiboCheckin().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = WeiboCheckin;