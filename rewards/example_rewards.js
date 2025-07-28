/**
 * 示例薅羊毛脚本
 * 
 * @name 示例平台活动
 * @description 自动参与示例平台活动，获取积分和奖励
 * @author agluo
 * @version 1.0.0
 * @env EXAMPLE_TOKENS Token信息，格式：token@备注&token@备注
 * @env EXAMPLE_USERIDS 用户ID，格式：userid@备注&userid@备注
 * @env EXAMPLE_DELAY 账号间隔时间（毫秒），默认3000
 * @env EXAMPLE_MAX_TASKS 每个账号最大任务数，默认10
 * @cron 0 10,14,18 * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class ExampleRewards {
    constructor() {
        this.name = '示例平台活动';
        this.version = '1.0.0';
        
        // 获取配置
        this.accounts = this.getAccounts();
        this.delay = parseInt(CommonUtils.getEnv('EXAMPLE_DELAY', '3000'));
        this.maxTasks = parseInt(CommonUtils.getEnv('EXAMPLE_MAX_TASKS', '10'));
        
        // 初始化通知管理器
        this.notify = new NotifyManager(this.getNotifyConfig());
        
        // 结果统计
        this.results = {
            total: 0,
            success: 0,
            failed: 0,
            totalRewards: 0,
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
        
        // 优先使用TOKENS环境变量
        const tokensEnv = CommonUtils.getEnv('EXAMPLE_TOKENS');
        if (tokensEnv) {
            const tokenList = tokensEnv.split('&');
            tokenList.forEach((token, index) => {
                const [tokenValue, remark] = token.split('@');
                if (tokenValue) {
                    accounts.push({
                        token: tokenValue,
                        remark: remark || `账号${index + 1}`,
                        type: 'token'
                    });
                }
            });
        }
        
        // 如果没有Token，则使用USERIDS环境变量
        if (accounts.length === 0) {
            const useridsEnv = CommonUtils.getEnv('EXAMPLE_USERIDS');
            if (useridsEnv) {
                const useridList = useridsEnv.split('&');
                useridList.forEach((userid, index) => {
                    const [useridValue, remark] = userid.split('@');
                    if (useridValue) {
                        accounts.push({
                            userId: useridValue,
                            remark: remark || `账号${index + 1}`,
                            type: 'userid'
                        });
                    }
                });
            }
        }

        if (accounts.length === 0) {
            CommonUtils.error('未获取到有效账号，请检查环境变量配置');
            CommonUtils.log('环境变量格式说明：');
            CommonUtils.log('EXAMPLE_TOKENS="token@备注&token@备注"');
            CommonUtils.log('EXAMPLE_USERIDS="userid@备注&userid@备注"');
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
     * 获取用户信息
     * @param {Object} account 账号信息
     * @returns {Object} 用户信息
     */
    async getUserInfo(account) {
        try {
            const headers = {};
            if (account.type === 'token') {
                headers['Authorization'] = `Bearer ${account.token}`;
            }

            const response = await this.request({
                url: 'https://example.com/api/user/info',
                method: 'GET',
                headers,
                params: account.type === 'userid' ? { userId: account.userId } : {}
            });

            if (response && response.code === 200) {
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response?.message || '获取用户信息失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取任务列表
     * @param {Object} account 账号信息
     * @returns {Array} 任务列表
     */
    async getTaskList(account) {
        try {
            const headers = {};
            if (account.type === 'token') {
                headers['Authorization'] = `Bearer ${account.token}`;
            }

            const response = await this.request({
                url: 'https://example.com/api/tasks',
                method: 'GET',
                headers,
                params: account.type === 'userid' ? { userId: account.userId } : {}
            });

            if (response && response.code === 200) {
                return response.data.tasks || [];
            } else {
                throw new Error(response?.message || '获取任务列表失败');
            }
        } catch (error) {
            CommonUtils.error(`[${account.remark}] 获取任务列表失败: ${error.message}`);
            return [];
        }
    }

    /**
     * 执行任务
     * @param {Object} account 账号信息
     * @param {Object} task 任务信息
     * @returns {Object} 执行结果
     */
    async doTask(account, task) {
        try {
            CommonUtils.log(`[${account.remark}] 执行任务: ${task.name}`);

            const headers = {};
            if (account.type === 'token') {
                headers['Authorization'] = `Bearer ${account.token}`;
            }

            const requestData = {
                taskId: task.id,
                timestamp: CommonUtils.timestamp()
            };

            if (account.type === 'userid') {
                requestData.userId = account.userId;
            }

            const response = await this.request({
                url: 'https://example.com/api/task/complete',
                method: 'POST',
                headers,
                data: requestData
            });

            if (response && response.code === 200) {
                const reward = response.data.reward || 0;
                CommonUtils.success(`[${account.remark}] 任务完成，获得奖励: ${reward}`);
                
                return {
                    success: true,
                    reward,
                    taskName: task.name
                };
            } else if (response && response.code === 1001) {
                CommonUtils.log(`[${account.remark}] 任务已完成: ${task.name}`);
                return {
                    success: true,
                    reward: 0,
                    taskName: task.name,
                    alreadyCompleted: true
                };
            } else {
                throw new Error(response?.message || '任务执行失败');
            }
        } catch (error) {
            CommonUtils.error(`[${account.remark}] 任务执行失败 ${task.name}: ${error.message}`);
            return { 
                success: false, 
                error: error.message,
                taskName: task.name
            };
        }
    }

    /**
     * 领取奖励
     * @param {Object} account 账号信息
     * @returns {Object} 领取结果
     */
    async claimRewards(account) {
        try {
            CommonUtils.log(`[${account.remark}] 尝试领取奖励`);

            const headers = {};
            if (account.type === 'token') {
                headers['Authorization'] = `Bearer ${account.token}`;
            }

            const requestData = {
                timestamp: CommonUtils.timestamp()
            };

            if (account.type === 'userid') {
                requestData.userId = account.userId;
            }

            const response = await this.request({
                url: 'https://example.com/api/rewards/claim',
                method: 'POST',
                headers,
                data: requestData
            });

            if (response && response.code === 200) {
                const totalReward = response.data.totalReward || 0;
                CommonUtils.success(`[${account.remark}] 奖励领取成功，获得: ${totalReward}`);
                
                return {
                    success: true,
                    totalReward
                };
            } else if (response && response.code === 1002) {
                CommonUtils.log(`[${account.remark}] 暂无可领取的奖励`);
                return {
                    success: true,
                    totalReward: 0,
                    noClaim: true
                };
            } else {
                throw new Error(response?.message || '奖励领取失败');
            }
        } catch (error) {
            CommonUtils.error(`[${account.remark}] 奖励领取失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * 处理单个账号
     * @param {Object} account 账号信息
     * @param {number} index 账号索引
     */
    async processAccount(account, index) {
        CommonUtils.log(`\n========== 处理第${index + 1}个账号: ${account.remark} ==========`);
        
        let accountReward = 0;
        let completedTasks = 0;
        let failedTasks = 0;
        const taskDetails = [];

        try {
            // 获取用户信息
            const userInfo = await this.getUserInfo(account);
            if (!userInfo.success) {
                this.results.failed++;
                this.results.details.push({
                    account: account.remark,
                    status: 'failed',
                    error: userInfo.error,
                    reward: 0
                });
                return;
            }

            CommonUtils.log(`[${account.remark}] 当前积分: ${userInfo.data.points || 0}`);

            // 获取任务列表
            const tasks = await this.getTaskList(account);
            if (tasks.length === 0) {
                CommonUtils.log(`[${account.remark}] 暂无可执行的任务`);
            } else {
                CommonUtils.log(`[${account.remark}] 获取到 ${tasks.length} 个任务`);

                // 执行任务（限制最大数量）
                const maxTasks = Math.min(tasks.length, this.maxTasks);
                for (let i = 0; i < maxTasks; i++) {
                    const task = tasks[i];
                    const result = await this.doTask(account, task);
                    
                    if (result.success) {
                        completedTasks++;
                        accountReward += result.reward || 0;
                        taskDetails.push({
                            name: result.taskName,
                            reward: result.reward || 0,
                            status: result.alreadyCompleted ? 'already_completed' : 'completed'
                        });
                    } else {
                        failedTasks++;
                        taskDetails.push({
                            name: result.taskName,
                            error: result.error,
                            status: 'failed'
                        });
                    }

                    // 任务间随机延时
                    if (i < maxTasks - 1) {
                        await CommonUtils.randomWait(1000, 3000);
                    }
                }
            }

            // 领取奖励
            const claimResult = await this.claimRewards(account);
            if (claimResult.success && !claimResult.noClaim) {
                accountReward += claimResult.totalReward;
            }

            // 记录结果
            this.results.success++;
            this.results.totalRewards += accountReward;
            this.results.details.push({
                account: account.remark,
                status: 'success',
                reward: accountReward,
                completedTasks,
                failedTasks,
                taskDetails
            });

            CommonUtils.success(`[${account.remark}] 处理完成，总获得奖励: ${accountReward}`);
            
        } catch (error) {
            CommonUtils.error(`[${account.remark}] 处理异常: ${error.message}`);
            this.results.failed++;
            this.results.details.push({
                account: account.remark,
                status: 'failed',
                error: error.message,
                reward: 0
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
        report += `❌ 失败: ${this.results.failed}\n`;
        report += `🎁 总奖励: ${this.results.totalRewards}\n\n`;

        // 详细结果
        this.results.details.forEach((detail, index) => {
            report += `${index + 1}. ${detail.account}: `;
            if (detail.status === 'success') {
                report += `✅ 获得奖励 ${detail.reward}`;
                if (detail.completedTasks > 0) {
                    report += ` (完成任务 ${detail.completedTasks}个)`;
                }
                report += `\n`;
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
    new ExampleRewards().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = ExampleRewards;