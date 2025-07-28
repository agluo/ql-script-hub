/**
 * 京东价格监控脚本
 * 
 * @name 京东价格监控
 * @description 监控京东商品价格变化，降价及时通知
 * @author agluo
 * @version 1.0.0
 * @env JD_MONITOR_ITEMS 监控商品，格式：商品名称|商品ID|目标价格@商品名称|商品ID|目标价格
 * @env JD_PRICE_THRESHOLD 价格变动阈值（百分比），默认0.05（5%）
 * @cron 0 */30 * * * *
 * @update 2025-01-01
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 引入工具模块
const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class JdPriceMonitor {
    constructor() {
        this.name = '京东价格监控';
        this.version = '1.0.0';
        
        // 获取配置
        this.monitorItems = this.getMonitorItems();
        this.priceThreshold = parseFloat(CommonUtils.getEnv('JD_PRICE_THRESHOLD', '0.05')); // 5%
        
        // 数据文件路径
        this.dataDir = path.join(__dirname, '../data');
        this.historyFile = path.join(this.dataDir, 'jd_price_history.json');
        
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
        CommonUtils.log(`共获取到 ${this.monitorItems.length} 个监控商品`);
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
     * 获取监控商品配置
     * @returns {Array} 监控商品数组
     */
    getMonitorItems() {
        const items = [];
        
        const itemsEnv = CommonUtils.getEnv('JD_MONITOR_ITEMS');
        if (itemsEnv) {
            const itemList = itemsEnv.split('@');
            itemList.forEach((item, index) => {
                const [name, skuId, targetPrice] = item.split('|');
                if (name && skuId) {
                    items.push({
                        id: CommonUtils.md5(name + skuId),
                        name: name.trim(),
                        skuId: skuId.trim(),
                        targetPrice: targetPrice ? parseFloat(targetPrice) : 0,
                        threshold: this.priceThreshold,
                        enabled: true,
                        remark: `商品${index + 1}`
                    });
                }
            });
        }

        if (items.length === 0) {
            CommonUtils.error('未获取到有效监控商品，请检查环境变量配置');
            CommonUtils.log('环境变量格式：JD_MONITOR_ITEMS="商品名称|商品ID|目标价格@商品名称|商品ID|目标价格"');
            CommonUtils.log('示例：JD_MONITOR_ITEMS="iPhone 15|100012043978|5000@AirPods Pro|100008348542|1500"');
        }

        return items;
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
     * 读取历史数据
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
     */
    async request(options) {
        const config = {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/html, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Referer': 'https://www.jd.com/',
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
     * 获取商品价格信息
     */
    async getProductPrice(item) {
        try {
            // 获取商品价格
            const priceResponse = await this.request({
                url: `https://p.3.cn/prices/mgets?skuIds=J_${item.skuId}&type=1`,
                method: 'GET'
            });

            if (!priceResponse.success) {
                throw new Error(`获取价格失败: ${priceResponse.error}`);
            }

            const priceData = priceResponse.data[0];
            if (!priceData) {
                throw new Error('商品价格数据为空');
            }

            // 获取商品基本信息
            const infoResponse = await this.request({
                url: `https://item.jd.com/${item.skuId}.html`,
                method: 'GET'
            });

            let title = item.name;
            let stock = '未知';
            
            if (infoResponse.success) {
                // 解析商品标题
                const titleMatch = infoResponse.data.match(/<title[^>]*>([^<]+)<\/title>/);
                if (titleMatch) {
                    title = titleMatch[1].replace(/【.*?】/g, '').trim();
                }

                // 解析库存状态
                if (infoResponse.data.includes('现货')) {
                    stock = '现货';
                } else if (infoResponse.data.includes('有货')) {
                    stock = '有货';
                } else if (infoResponse.data.includes('无货') || infoResponse.data.includes('缺货')) {
                    stock = '无货';
                } else if (infoResponse.data.includes('预售')) {
                    stock = '预售';
                }
            }

            return {
                success: true,
                data: {
                    name: title,
                    price: parseFloat(priceData.p) || 0,
                    originalPrice: parseFloat(priceData.m) || 0,
                    stock: stock,
                    status: '正常',
                    url: `https://item.jd.com/${item.skuId}.html`
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 检查单个商品
     */
    async checkItem(item, historyData) {
        CommonUtils.log(`检查商品: ${item.name} (${item.skuId})`);
        
        try {
            // 获取商品价格信息
            const result = await this.getProductPrice(item);
            
            if (!result.success) {
                throw new Error(result.error);
            }

            const currentInfo = result.data;
            const timestamp = CommonUtils.timestampMs();

            // 获取历史数据
            const itemHistory = historyData.items[item.id] || {
                name: item.name,
                skuId: item.skuId,
                history: [],
                lastNotify: 0,
                notifications: 0
            };

            // 更新历史记录
            itemHistory.history.push({
                timestamp,
                ...currentInfo
            });

            // 只保留最近50条记录
            if (itemHistory.history.length > 50) {
                itemHistory.history = itemHistory.history.slice(-50);
            }

            // 分析价格变化
            const changes = this.analyzePriceChanges(item, currentInfo, itemHistory);
            
            // 更新历史数据
            historyData.items[item.id] = itemHistory;

            const checkResult = {
                item: item.name,
                skuId: item.skuId,
                status: 'success',
                currentInfo,
                changes,
                needNotify: changes.some(change => change.important)
            };

            CommonUtils.success(`[${item.name}] 当前价格: ¥${currentInfo.price}, 库存: ${currentInfo.stock}`);

            return checkResult;

        } catch (error) {
            CommonUtils.error(`[${item.name}] 检查失败: ${error.message}`);
            return {
                item: item.name,
                skuId: item.skuId,
                status: 'failed',
                error: error.message,
                needNotify: false
            };
        }
    }

    /**
     * 分析价格变化
     */
    analyzePriceChanges(item, currentInfo, itemHistory) {
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
            const changeAmount = (currentInfo.price - lastInfo.price).toFixed(2);
            
            let important = Math.abs(priceChange) >= item.threshold;
            
            // 检查是否达到目标价格
            if (item.targetPrice > 0 && currentInfo.price <= item.targetPrice && lastInfo.price > item.targetPrice) {
                important = true;
                changes.push({
                    type: 'target_price_reached',
                    message: `🎯 ${item.name} 已达到目标价格！\n当前价格: ¥${currentInfo.price}\n目标价格: ¥${item.targetPrice}\n商品链接: ${currentInfo.url}`,
                    important: true
                });
            } else if (priceChange < 0) {
                // 降价通知
                changes.push({
                    type: 'price_drop',
                    message: `📉 ${item.name} 降价了！\n降价金额: ¥${Math.abs(changeAmount)} (${Math.abs(changePercent)}%)\n当前价格: ¥${currentInfo.price}\n原价格: ¥${lastInfo.price}\n商品链接: ${currentInfo.url}`,
                    important: important && (now - itemHistory.lastNotify > notifyCooldown)
                });
            } else {
                // 涨价通知
                changes.push({
                    type: 'price_rise',
                    message: `📈 ${item.name} 涨价了！\n涨价金额: ¥${changeAmount} (${changePercent}%)\n当前价格: ¥${currentInfo.price}\n原价格: ¥${lastInfo.price}`,
                    important: important && (now - itemHistory.lastNotify > notifyCooldown)
                });
            }
        }

        // 库存变化检查
        if (currentInfo.stock !== lastInfo.stock) {
            let important = false;
            let message = '';
            
            if ((currentInfo.stock === '现货' || currentInfo.stock === '有货') && 
                (lastInfo.stock === '无货' || lastInfo.stock === '缺货')) {
                important = true;
                message = `📦 ${item.name} 补货了！\n当前状态: ${currentInfo.stock}\n当前价格: ¥${currentInfo.price}\n商品链接: ${currentInfo.url}`;
            } else if ((currentInfo.stock === '无货' || currentInfo.stock === '缺货') && 
                      (lastInfo.stock === '现货' || lastInfo.stock === '有货')) {
                message = `⚠️ ${item.name} 缺货了！\n当前状态: ${currentInfo.stock}`;
            } else {
                message = `📋 ${item.name} 库存状态变化: ${lastInfo.stock} → ${currentInfo.stock}`;
            }
            
            changes.push({
                type: 'stock_change',
                message,
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
     */
    async sendChangeNotifications(results) {
        const importantChanges = results.filter(result => result.needNotify && result.changes);
        
        if (importantChanges.length === 0) {
            CommonUtils.log('无重要价格变化，不发送通知');
            return;
        }

        // 按变化类型分组
        const targetPriceReached = [];
        const priceDrops = [];
        const stockChanges = [];

        importantChanges.forEach(result => {
            result.changes.forEach(change => {
                if (change.important) {
                    if (change.type === 'target_price_reached') {
                        targetPriceReached.push(change.message);
                    } else if (change.type === 'price_drop') {
                        priceDrops.push(change.message);
                    } else if (change.type === 'stock_change') {
                        stockChanges.push(change.message);
                    }
                }
            });
        });

        // 发送不同类型的通知
        if (targetPriceReached.length > 0) {
            const message = `🎯 目标价格提醒\n\n${targetPriceReached.join('\n\n')}\n\n⏰ ${CommonUtils.formatTime()}`;
            await this.notify.send(message, '🛒 京东目标价格达成');
            this.results.notified++;
        }

        if (priceDrops.length > 0) {
            const message = `📉 降价提醒\n\n${priceDrops.join('\n\n')}\n\n⏰ ${CommonUtils.formatTime()}`;
            await this.notify.send(message, '💰 京东商品降价通知');
            this.results.notified++;
        }

        if (stockChanges.length > 0) {
            const message = `📦 库存变化提醒\n\n${stockChanges.join('\n\n')}\n\n⏰ ${CommonUtils.formatTime()}`;
            await this.notify.send(message, '📦 京东库存变化通知');
            this.results.notified++;
        }
    }

    /**
     * 生成结果报告
     */
    generateReport() {
        let report = `📊 ${this.name} 执行结果\n\n`;
        report += `🎯 总商品数: ${this.results.total}\n`;
        report += `✅ 检查成功: ${this.results.checked}\n`;
        report += `🔄 发现变化: ${this.results.changed}\n`;
        report += `📨 发送通知: ${this.results.notified}\n`;
        report += `❌ 检查失败: ${this.results.failed}\n\n`;

        // 详细结果
        if (this.results.details.length > 0) {
            report += '📋 商品价格:\n';
            this.results.details.forEach((detail, index) => {
                report += `${index + 1}. ${detail.item}: `;
                if (detail.status === 'success') {
                    report += `¥${detail.currentInfo.price} (${detail.currentInfo.stock})`;
                    if (detail.changes && detail.changes.length > 0) {
                        const importantChanges = detail.changes.filter(c => c.important);
                        if (importantChanges.length > 0) {
                            report += ` 🔔`;
                        }
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
                await this.notify.sendError(this.name, '未获取到有效监控商品，请检查环境变量配置');
                return;
            }

            this.results.total = this.monitorItems.length;

            // 读取历史数据
            const historyData = this.readHistoryData();

            // 检查所有商品
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

                // 商品间延时
                if (i < this.monitorItems.length - 1) {
                    await CommonUtils.randomWait(3000, 6000);
                }
            }

            // 保存历史数据
            this.saveHistoryData(historyData);

            // 发送变化通知
            await this.sendChangeNotifications(this.results.details);

            // 生成并输出结果报告
            const report = this.generateReport();
            CommonUtils.log('\n' + report);

            // 只有失败时才发送总结通知（重要变化已经单独通知了）
            if (this.results.failed > 0) {
                await this.notify.sendWarning(this.name, report);
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
    new JdPriceMonitor().main().catch(error => {
        CommonUtils.error(`脚本执行失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = JdPriceMonitor;