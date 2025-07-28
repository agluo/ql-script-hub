/**
 * 示例监控脚本
 * 
 * @name 示例平台监控
 * @description 监控商品价格、库存等信息，及时通知变化
 * @author agluo
 * @version 1.0.0
 * @env EXAMPLE_MONITOR_ITEMS 监控项目，格式：名称|链接|目标价格@名称|链接|目标价格
 * @env EXAMPLE_MONITOR_CONFIG JSON格式的监控配置
 * @env EXAMPLE_CHECK_INTERVAL 检查间隔时间（毫秒），默认1800000（30分钟）
 * @env EXAMPLE_PRICE_THRESHOLD 价格变动阈值（百分比），默认0.05（5%）
 * @cron 0 */30 * * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class ExampleMonitor {
    constructor() {
        this.name = '示例平台监控';
        this.version = '1.0.0';
        
        // 获取配置
        this.monitorItems = this.getMonitorItems();
        this.checkInterval = parseInt(CommonUtils.getEnv('EXAMPLE_CHECK_INTERVAL', '1800000')); // 30分钟
        this.priceThreshold = parseFloat(CommonUtils.getEnv('EXAMPLE_PRICE_THRESHOLD', '0.05')); // 5%
        
        // 数据文件路径
        this.dataDir = path.join(__dirname, '../data');
        this.historyFile = path.join(this.dataDir, 'monitor_history.json');
        this.notifyLogFile = path.join(this.dataDir, 'notification_log.json');
        
        // 初始化通知管理器
        this.notify = new NotifyManager(this.getNotifyConfig());
        
        // 结果统计
        this.results = {
            total: 0,
            checked: 0,
            changed: 0,
            notified: 0,
            failed: 0,
            details: []
        };

        // 初始化数据目录
        this.initDataDir();

        CommonUtils.log(`${this.name} v${this.version} 开始执行`);
        CommonUtils.log(`共获取到 ${this.monitorItems.length} 个监控项目`);
    }

    /**
     * 初始化数据目录
     */
    initDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            CommonUtils.log('创建数据目录: ' + this.dataDir);
        }
    }

    /**
     * 获取监控项目配置
     * @returns {Array} 监控项目数组
     */
    getMonitorItems() {
        const items = [];
        
        // 优先使用JSON配置
        const configEnv = CommonUtils.getEnv('EXAMPLE_MONITOR_CONFIG');
        if (configEnv) {
            try {
                const config = JSON.parse(configEnv);
                if (Array.isArray(config)) {
                    return config.filter(item => item.enabled !== false);
                }
            } catch (error) {
                CommonUtils.error('JSON配置解析失败: ' + error.message);
            }
        }
        
        // 使用简单格式配置
        const itemsEnv = CommonUtils.getEnv('EXAMPLE_MONITOR_ITEMS');
        if (itemsEnv) {
            const itemList = itemsEnv.split('@');
            itemList.forEach((item, index) => {
                const [name, url, targetPrice] = item.split('|');
                if (name && url) {
                    items.push({
                        id: CommonUtils.md5(name + url),
                        name: name.trim(),
                        url: url.trim(),
                        targetPrice: targetPrice ? parseFloat(targetPrice) : 0,
                        monitorType: 'price',
                        threshold: this.priceThreshold,
                        enabled: true,
                        remark: `监控项目${index + 1}`
                    });
                }
            });
        }

        if (items.length === 0) {
            CommonUtils.error('未获取到有效监控项目，请检查环境变量配置');
            CommonUtils.log('环境变量格式说明：');
            CommonUtils.log('EXAMPLE_MONITOR_ITEMS="商品名称|商品链接|目标价格@商品名称|商品链接|目标价格"');
            CommonUtils.log('EXAMPLE_MONITOR_CONFIG=\'[{"name":"商品名称","url":"商品链接","targetPrice":100}]\'');
        }

        return items;
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
     * 读取历史数据
     * @returns {Object} 历史数据
     */
    readHistoryData() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const data = fs.readFileSync(this.historyFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            CommonUtils.error('读取历史数据失败: ' + error.message);
        }
        
        return {
            items: {},
            lastUpdate: 0
        };
    }

    /**
     * 保存历史数据
     * @param {Object} data 历史数据
     */
    saveHistoryData(data) {
        try {
            data.lastUpdate = CommonUtils.timestampMs();
            fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            CommonUtils.error('保存历史数据失败: ' + error.message);
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
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                ),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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
     * 解析商品信息
     * @param {string} html 页面HTML
     * @param {Object} item 监控项目
     * @returns {Object} 商品信息
     */
    parseProductInfo(html, item) {
        try {
            // 这里是示例解析逻辑，实际使用时需要根据目标网站的HTML结构进行调整
            const info = {
                name: item.name,
                price: 0,
                stock: '未知',
                status: '正常'
            };

            // 示例：解析价格（这里使用正则表达式，实际项目中建议使用cheerio等HTML解析库）
            const priceMatch = html.match(/price["\']?\s*:?\s*["\']?(\d+\.?\d*)/i);
            if (priceMatch) {
                info.price = parseFloat(priceMatch[1]);
            }

            // 示例：解析库存状态
            const stockPatterns = [
                /现货|有货|in stock/i,
                /缺货|无货|out of stock/i,
                /预售|pre-order/i
            ];

            for (const pattern of stockPatterns) {
                if (pattern.test(html)) {
                    if (pattern.source.includes('现货|有货|in stock')) {
                        info.stock = '有货';
                    } else if (pattern.source.includes('缺货|无货|out of stock')) {
                        info.stock = '缺货';
                    } else if (pattern.source.includes('预售|pre-order')) {
                        info.stock = '预售';
                    }
                    break;
                }
            }

            // 检查商品是否下架
            if (html.includes('商品不存在') || html.includes('页面不存在') || html.includes('404')) {
                info.status = '已下架';
            }

            return info;
        } catch (error) {
            CommonUtils.error(`解析商品信息失败: ${error.message}`);
            return {
                name: item.name,
                price: 0,
                stock: '解析失败',
                status: '异常'
            };
        }
    }

    /**
     * 检查单个监控项目
     * @param {Object} item 监控项目
     * @param {Object} historyData 历史数据
     * @returns {Object} 检查结果
     */
    async checkItem(item, historyData) {
        CommonUtils.log(`检查监控项目: ${item.name}`);
        
        try {
            // 获取页面内容
            const response = await this.request({
                url: item.url,
                method: 'GET'
            });

            if (!response.success) {
                throw new Error(`请求失败: ${response.error}`);
            }

            // 解析商品信息
            const currentInfo = this.parseProductInfo(response.data, item);
            const timestamp = CommonUtils.timestampMs();

            // 获取历史数据
            const itemHistory = historyData.items[item.id] || {
                name: item.name,
                url: item.url,
                history: [],
                lastNotify: 0,
                notifications: 0
            };

            // 更新历史记录
            itemHistory.history.push({
                timestamp,
                ...currentInfo
            });

            // 只保留最近100条记录
            if (itemHistory.history.length > 100) {
                itemHistory.history = itemHistory.history.slice(-100);
            }

            // 分析变化
            const changes = this.analyzeChanges(item, currentInfo, itemHistory);
            
            // 更新历史数据
            historyData.items[item.id] = itemHistory;

            const result = {
                item: item.name,
                status: 'success',
                currentInfo,
                changes,
                needNotify: changes.some(change => change.important)
            };

            CommonUtils.success(`[${item.name}] 检查完成 - 价格: ${currentInfo.price}, 库存: ${currentInfo.stock}`);

            return result;

        } catch (error) {
            CommonUtils.error(`[${item.name}] 检查失败: ${error.message}`);
            return {
                item: item.name,
                status: 'failed',
                error: error.message,
                needNotify: false
            };
        }
    }

    /**
     * 分析数据变化
     * @param {Object} item 监控项目
     * @param {Object} currentInfo 当前信息
     * @param {Object} itemHistory 历史数据
     * @returns {Array} 变化列表
     */
    analyzeChanges(item, currentInfo, itemHistory) {
        const changes = [];
        
        if (itemHistory.history.length === 0) {
            return changes; // 首次检查，无历史数据
        }

        const lastInfo = itemHistory.history[itemHistory.history.length - 1];
        const now = CommonUtils.timestampMs();
        const notifyCooldown = 3600000; // 1小时通知冷却期

        // 价格变化检查
        if (currentInfo.price !== lastInfo.price && currentInfo.price > 0 && lastInfo.price > 0) {
            const priceChange = (currentInfo.price - lastInfo.price) / lastInfo.price;
            const changePercent = (priceChange * 100).toFixed(2);
            
            let important = Math.abs(priceChange) >= item.threshold;
            
            // 检查是否达到目标价格
            if (item.targetPrice > 0 && currentInfo.price <= item.targetPrice && lastInfo.price > item.targetPrice) {
                important = true;
                changes.push({
                    type: 'target_price_reached',
                    message: `🎯 ${item.name} 已达到目标价格！当前价格: ¥${currentInfo.price}，目标价格: ¥${item.targetPrice}`,
                    important: true
                });
            } else {
                changes.push({
                    type: 'price_change',
                    message: `💰 ${item.name} 价格${priceChange > 0 ? '上涨' : '下降'} ${Math.abs(changePercent)}%，当前价格: ¥${currentInfo.price}`,
                    important: important && (now - itemHistory.lastNotify > notifyCooldown)
                });
            }
        }

        // 库存变化检查
        if (currentInfo.stock !== lastInfo.stock) {
            let important = false;
            let message = '';
            
            if (currentInfo.stock === '有货' && lastInfo.stock === '缺货') {
                important = true;
                message = `📦 ${item.name} 补货了！当前状态: ${currentInfo.stock}`;
            } else if (currentInfo.stock === '缺货' && lastInfo.stock === '有货') {
                important = true;
                message = `⚠️ ${item.name} 缺货了！当前状态: ${currentInfo.stock}`;
            } else {
                message = `📋 ${item.name} 库存状态变化: ${lastInfo.stock} → ${currentInfo.stock}`;
            }
            
            changes.push({
                type: 'stock_change',
                message,
                important: important && (now - itemHistory.lastNotify > notifyCooldown)
            });
        }

        // 商品状态变化检查
        if (currentInfo.status !== lastInfo.status) {
            const important = currentInfo.status === '已下架';
            changes.push({
                type: 'status_change',
                message: `🔄 ${item.name} 状态变化: ${lastInfo.status} → ${currentInfo.status}`,
                important: important && (now - itemHistory.lastNotify > notifyCooldown)
            });
        }

        // 更新通知时间
        if (changes.some(change => change.important)) {
            itemHistory.lastNotify = now;
            itemHistory.notifications++;
        }

        return changes;
    }

    /**
     * 发送变化通知
     * @param {Array} results 检查结果
     */
    async sendChangeNotifications(results) {
        const importantChanges = results.filter(result => result.needNotify && result.changes);
        
        if (importantChanges.length === 0) {
            CommonUtils.log('无重要变化，不发送通知');
            return;
        }

        let message = `📊 监控检查发现 ${importantChanges.length} 个重要变化：\n\n`;
        
        importantChanges.forEach((result, index) => {
            message += `${index + 1}. ${result.item}:\n`;
            result.changes.forEach(change => {
                if (change.important) {
                    message += `   ${change.message}\n`;
                }
            });
            message += '\n';
        });

        message += `⏰ 检查时间: ${CommonUtils.formatTime()}`;

        try {
            await this.notify.send(message, '🔍 监控变化通知');
            this.results.notified++;
            CommonUtils.success('变化通知发送成功');
        } catch (error) {
            CommonUtils.error('变化通知发送失败: ' + error.message);
        }
    }

    /**
     * 生成结果报告
     * @returns {string} 结果报告
     */
    generateReport() {
        let report = `📊 ${this.name} 执行结果\n\n`;
        report += `🎯 总监控项目: ${this.results.total}\n`;
        report += `✅ 检查成功: ${this.results.checked}\n`;
        report += `🔄 发现变化: ${this.results.changed}\n`;
        report += `📨 发送通知: ${this.results.notified}\n`;
        report += `❌ 检查失败: ${this.results.failed}\n\n`;

        // 详细结果
        if (this.results.details.length > 0) {
            report += '📋 详细结果:\n';
            this.results.details.forEach((detail, index) => {
                report += `${index + 1}. ${detail.item}: `;
                if (detail.status === 'success') {
                    report += `✅ 价格: ¥${detail.currentInfo.price}, 库存: ${detail.currentInfo.stock}`;
                    if (detail.changes && detail.changes.length > 0) {
                        report += ` (${detail.changes.length}个变化)`;
                    }
                } else {
                    report += `❌ ${detail.error}`;
                }
                report += '\n';
            });
        }

        report += `\n⏰ 执行时间: ${CommonUtils.formatTime()}`;
        return report;
    }

    /**
     * 主执行函数
     */
    async main() {
        try {
            if (this.monitorItems.length === 0) {
                await this.notify.sendError(this.name, '未获取到有效监控项目，请检查环境变量配置');
                return;
            }

            this.results.total = this.monitorItems.length;

            // 读取历史数据
            const historyData = this.readHistoryData();

            // 检查所有监控项目
            for (let i = 0; i < this.monitorItems.length; i++) {
                const item = this.monitorItems[i];
                const result = await this.checkItem(item, historyData);
                
                if (result.status === 'success') {
                    this.results.checked++;
                    if (result.changes && result.changes.length > 0) {
                        this.results.changed++;
                    }
                } else {
                    this.results.failed++;
                }
                
                this.results.details.push(result);

                // 项目间延时
                if (i < this.monitorItems.length - 1) {
                    await CommonUtils.randomWait(2000, 5000);
                }
            }

            // 保存历史数据
            this.saveHistoryData(historyData);

            // 发送变化通知
            await this.sendChangeNotifications(this.results.details);

            // 生成并输出结果报告
            const report = this.generateReport();
            CommonUtils.log('\n' + report);

            // 只有失败或发现重要变化时才发送总结通知
            if (this.results.failed > 0) {
                await this.notify.sendWarning(this.name, report);
            } else if (this.results.changed > 0) {
                // 重要变化已经单独通知了，这里只记录日志
                CommonUtils.success('监控检查完成，已发送变化通知');
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
    new ExampleMonitor().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = ExampleMonitor;