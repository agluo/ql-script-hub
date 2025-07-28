# 薅羊毛类脚本

> 自动参与各种活动，获取优惠券、积分等奖励

## 📋 脚本列表

| 脚本名称 | 描述 | 状态 | 更新时间 |
|---------|------|------|----------|
| example_rewards.js | 薅羊毛脚本模板 | ✅ 可用 | 2025-01-01 |

## 🚀 使用方法

### 1. 配置环境变量

在青龙面板中添加以下环境变量：

```bash
# 示例活动配置
EXAMPLE_TOKENS="token1@remark1&token2@remark2"

# 或使用用户ID方式
EXAMPLE_USERIDS="userid1@remark1&userid2@remark2"
```

### 2. 添加定时任务

在青龙面板中添加定时任务：

```bash
# 每天多个时间段执行
0 10,14,18 * * * node /ql/scripts/rewards/example_rewards.js
```

## ⚙️ 环境变量说明

### 通用环境变量

- `NOTIFY_ENABLED`: 是否启用通知 (true/false，默认true)
- `BARK_KEY`: Bark推送Key
- `SERVERCHAN_KEY`: Server酱推送Key
- `PUSHPLUS_TOKEN`: PushPlus推送Token

### 脚本特定环境变量

#### example_rewards.js

- `EXAMPLE_TOKENS`: Token格式 `token@备注&token@备注`
- `EXAMPLE_USERIDS`: 用户ID格式 `userid@备注&userid@备注`
- `EXAMPLE_DELAY`: 账号间隔时间（毫秒，默认3000）
- `EXAMPLE_MAX_TASKS`: 每个账号最大任务数（默认10）

## 📝 脚本开发规范

### 1. 文件命名

- 使用小写字母和下划线
- 格式：`平台名_活动名.js`
- 示例：`jd_fruit.js`、`taobao_farm.js`

### 2. 代码结构

```javascript
/**
 * 脚本名称：平台活动
 * 脚本描述：自动参与XXX平台活动
 * 环境变量：XXX_TOKENS 或 XXX_USERIDS
 * cron表达式：0 10,14,18 * * *
 */

const CommonUtils = require('../utils/common');
const NotifyManager = require('../utils/notify');

class PlatformRewards {
    constructor() {
        this.name = '平台活动';
        this.accounts = this.getAccounts();
        this.notify = new NotifyManager(this.getNotifyConfig());
    }

    async main() {
        // 主执行逻辑
    }
}

// 执行脚本
new PlatformRewards().main();
```

### 3. 必要功能

- ✅ 多账号支持
- ✅ 任务自动执行
- ✅ 奖励自动领取
- ✅ 错误处理
- ✅ 通知推送
- ✅ 日志记录
- ✅ 随机延时

## 🎯 活动类型

### 1. 签到类活动
- 每日签到获取积分
- 连续签到获得额外奖励

### 2. 任务类活动
- 浏览商品获取奖励
- 分享活动获得积分
- 邀请好友获得奖励

### 3. 抽奖类活动
- 消耗积分参与抽奖
- 免费抽奖机会

### 4. 养成类活动
- 种植果树类游戏
- 养宠物类游戏
- 农场类游戏

## 🔧 调试方法

### 1. 本地调试

```bash
# 设置环境变量
export EXAMPLE_TOKENS="test_token@测试账号"
export DEBUG=true

# 运行脚本
node example_rewards.js
```

### 2. 青龙面板调试

在青龙面板的日志中查看执行结果和错误信息。

## ⚠️ 注意事项

### 1. 频率控制
- 不要设置过高的执行频率
- 建议每天3-5次即可
- 避免被平台检测为异常行为

### 2. 账号安全
- 不要使用主力账号测试
- 建议使用小号进行测试
- 定期检查账号状态

### 3. 合规使用
- 遵守平台使用规则
- 不要进行恶意刷量
- 适度薅羊毛，避免贪心

## ❓ 常见问题

### Q: 活动脚本没有奖励？

A: 检查以下几点：
1. 活动是否还在进行中
2. 账号是否符合参与条件
3. 今日是否已达到上限
4. 脚本逻辑是否需要更新

### Q: 如何判断活动是否结束？

A: 通常活动结束会返回特定的错误码或消息，需要在脚本中添加相应的判断逻辑。

### Q: 为什么有些任务执行失败？

A: 可能的原因：
1. 任务已完成
2. 任务有时间限制
3. 需要人工干预的任务
4. 网络问题或接口变更

## 📞 反馈与建议

如有问题或建议，请在 [Issues](https://github.com/agluo/ql-script-hub/issues) 中反馈。