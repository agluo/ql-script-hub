# 监控类脚本

> 监控商品价格、库存等信息，及时通知变化

## 📋 脚本列表

| 脚本名称 | 描述 | 状态 | 更新时间 |
|---------|------|------|----------|
| example_monitor.js | 监控脚本模板 | ✅ 可用 | 2025-01-01 |
| jd_price_monitor.js | 京东商品价格监控 | ✅ 可用 | 2025-01-01 |

## 🚀 使用方法

### 1. 配置环境变量

在青龙面板中添加以下环境变量：

```bash
# 京东价格监控
JD_MONITOR_ITEMS="iPhone 15|100012043978|5000@AirPods Pro|100008348542|1500"

# 示例监控配置
EXAMPLE_MONITOR_ITEMS="商品名称|商品链接|目标价格@商品名称|商品链接|目标价格"
```

### 2. 添加定时任务

在青龙面板中添加定时任务：

```bash
# 京东价格监控 - 每30分钟检查一次
0 */30 * * * * node /ql/scripts/monitor/jd_price_monitor.js

# 示例监控 - 每30分钟检查一次
0 */30 * * * * node /ql/scripts/monitor/example_monitor.js
```

## ⚙️ 环境变量说明

### 通用环境变量

- `NOTIFY_ENABLED`: 是否启用通知 (true/false，默认true)
- `BARK_KEY`: Bark推送Key
- `SERVERCHAN_KEY`: Server酱推送Key
- `PUSHPLUS_TOKEN`: PushPlus推送Token

### 脚本特定环境变量

#### jd_price_monitor.js (京东价格监控)

- `JD_MONITOR_ITEMS`: 监控商品，格式：`商品名称|商品ID|目标价格@商品名称|商品ID|目标价格`
- `JD_PRICE_THRESHOLD`: 价格变动阈值（百分比，默认0.05即5%）

**功能特点：**
- ✅ 实时监控京东商品价格
- ✅ 目标价格达成通知
- ✅ 降价/涨价变动提醒
- ✅ 库存状态监控
- ✅ 价格历史记录
- ✅ 智能通知冷却期

**京东商品ID获取方法：**
1. 打开京东商品页面
2. 查看URL，如：`https://item.jd.com/100012043978.html`
3. 其中 `100012043978` 就是商品ID

#### example_monitor.js (示例脚本)

- `EXAMPLE_MONITOR_ITEMS`: 监控项目，格式：`名称|链接|目标价格@名称|链接|目标价格`
- `EXAMPLE_MONITOR_CONFIG`: JSON格式的监控配置
- `EXAMPLE_CHECK_INTERVAL`: 检查间隔时间（毫秒，默认1800000即30分钟）
- `EXAMPLE_PRICE_THRESHOLD`: 价格变动阈值（默认5%）

## 📝 配置示例

### 1. 京东价格监控配置

```bash
# 监控单个商品
JD_MONITOR_ITEMS="iPhone 15|100012043978|5000"

# 监控多个商品
JD_MONITOR_ITEMS="iPhone 15|100012043978|5000@MacBook Pro|100008348542|8000@AirPods Pro|100008348542|1500"

# 设置价格变动阈值为3%
JD_PRICE_THRESHOLD="0.03"
```

### 2. 通知配置示例

```bash
# 启用Bark推送
BARK_KEY="your_bark_key"

# 启用Server酱推送
SERVERCHAN_KEY="your_server_chan_key"

# 启用PushPlus推送
PUSHPLUS_TOKEN="your_pushplus_token"
```

## 🎯 监控类型

### 1. 价格监控
- **京东商品价格** - 实时监控价格变动
- **目标价格提醒** - 达到设定价格立即通知
- **降价通知** - 商品降价及时提醒
- **涨价预警** - 价格上涨提前知晓

### 2. 库存监控
- **缺货/补货提醒** - 库存状态变化通知
- **现货状态** - 实时跟踪库存情况
- **预售信息** - 预售商品状态更新

### 3. 智能通知
- **通知冷却期** - 避免频繁推送相同消息
- **重要变化优先** - 重要变化立即通知
- **分类推送** - 不同类型变化分别推送

## 🔧 调试方法

### 1. 本地调试

```bash
# 京东价格监控调试
export JD_MONITOR_ITEMS="测试商品|100012043978|1000"
export DEBUG=true
node jd_price_monitor.js

# 示例监控调试
export EXAMPLE_MONITOR_ITEMS="测试商品|https://example.com/test|100"
export DEBUG=true
node example_monitor.js
```

### 2. 青龙面板调试

在青龙面板的日志中查看执行结果和错误信息。

## 📊 数据存储

### 1. 历史数据文件

脚本会自动创建数据目录存储监控历史：

```
ql-script-hub/
├── data/
│   ├── jd_price_history.json      # 京东价格历史
│   ├── monitor_history.json       # 通用监控历史
│   └── notification_log.json      # 通知记录
```

### 2. 数据格式示例

```json
{
  "items": {
    "商品ID": {
      "name": "商品名称",
      "skuId": "100012043978",
      "history": [
        {
          "timestamp": 1640995200000,
          "price": 5999,
          "originalPrice": 6999,
          "stock": "现货",
          "status": "正常"
        }
      ],
      "lastNotify": 1640995200000,
      "notifications": 5
    }
  },
  "lastUpdate": 1640995200000
}
```

## ⚠️ 注意事项

### 1. 请求频率
- 建议监控间隔30分钟以上
- 避免对目标网站造成压力
- 商品间请求增加随机延时

### 2. 反爬虫措施
- 使用合理的User-Agent
- 添加随机延时和请求头
- 避免高频率请求

### 3. 通知管理
- 设置通知冷却期避免刷屏
- 重要变化（如目标价格达成）立即通知
- 普通价格变动按阈值过滤

### 4. 数据准确性
- 定期验证监控逻辑
- 处理页面结构变化
- 记录异常情况便于调试

## 📈 监控策略建议

### 1. 目标价格设置
- 根据商品历史价格设定合理目标
- 考虑节庆促销时段
- 设置多个价格梯度

### 2. 通知频率控制
```javascript
// 重要变化立即通知
if (targetPriceReached || significantDrop) {
    await notify.send(message);
}

// 普通变化设置冷却期
if (Date.now() - lastNotify > 3600000) { // 1小时
    await notify.send(message);
}
```

### 3. 监控商品建议
- 控制监控商品数量（建议10个以内）
- 选择价格波动较大的商品
- 关注热门商品和促销商品

## ❓ 常见问题

### Q: 为什么价格监控不准确？

A: 可能的原因：
1. 京东价格接口可能有缓存
2. 不同地区价格可能不同
3. 会员价和普通价格差异
4. 网络请求失败或超时

### Q: 如何获取京东商品ID？

A: 方法：
1. 打开京东商品详情页
2. 查看浏览器地址栏URL
3. 提取item.jd.com/后面的数字
4. 例如：`100012043978`

### Q: 监控频率如何设置？

A: 建议：
- 热门商品：30分钟
- 普通商品：1小时
- 冷门商品：2-6小时
- 避免过于频繁的请求

### Q: 如何添加其他平台监控？

A: 参考现有脚本：
1. 复制 `jd_price_monitor.js` 作为模板
2. 修改商品信息获取接口
3. 调整数据解析逻辑
4. 测试验证功能正常

## 📞 反馈与建议

如有问题或建议，请在 [Issues](https://github.com/agluo/ql-script-hub/issues) 中反馈。

### 功能请求

欢迎提交新的监控平台需求：
- 淘宝/天猫价格监控
- 拼多多价格监控
- 苏宁易购价格监控
- 亚马逊价格监控
- 其他电商平台...