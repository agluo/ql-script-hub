/**
 * 通用工具函数库
 * 
 * @author agluo
 * @version 1.0.0
 * @description 提供青龙脚本常用的工具函数
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CommonUtils {
    /**
     * 等待指定时间
     * @param {number} ms 等待时间（毫秒）
     * @returns {Promise}
     */
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 随机等待
     * @param {number} min 最小等待时间（毫秒）
     * @param {number} max 最大等待时间（毫秒）
     * @returns {Promise}
     */
    static randomWait(min = 1000, max = 3000) {
        const ms = Math.floor(Math.random() * (max - min + 1)) + min;
        return this.wait(ms);
    }

    /**
     * 生成随机字符串
     * @param {number} length 字符串长度
     * @param {string} chars 字符集
     * @returns {string}
     */
    static randomString(length = 10, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 生成随机数字
     * @param {number} min 最小值
     * @param {number} max 最大值
     * @returns {number}
     */
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * MD5加密
     * @param {string} str 要加密的字符串
     * @returns {string}
     */
    static md5(str) {
        return crypto.createHash('md5').update(str).digest('hex');
    }

    /**
     * SHA256加密
     * @param {string} str 要加密的字符串
     * @returns {string}
     */
    static sha256(str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    /**
     * Base64编码
     * @param {string} str 要编码的字符串
     * @returns {string}
     */
    static base64Encode(str) {
        return Buffer.from(str).toString('base64');
    }

    /**
     * Base64解码
     * @param {string} str 要解码的字符串
     * @returns {string}
     */
    static base64Decode(str) {
        return Buffer.from(str, 'base64').toString();
    }

    /**
     * URL编码
     * @param {string} str 要编码的字符串
     * @returns {string}
     */
    static urlEncode(str) {
        return encodeURIComponent(str);
    }

    /**
     * URL解码
     * @param {string} str 要解码的字符串
     * @returns {string}
     */
    static urlDecode(str) {
        return decodeURIComponent(str);
    }

    /**
     * 获取当前时间戳（秒）
     * @returns {number}
     */
    static timestamp() {
        return Math.floor(Date.now() / 1000);
    }

    /**
     * 获取当前时间戳（毫秒）
     * @returns {number}
     */
    static timestampMs() {
        return Date.now();
    }

    /**
     * 格式化时间
     * @param {Date|number} date 时间对象或时间戳
     * @param {string} format 格式字符串
     * @returns {string}
     */
    static formatTime(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
        if (typeof date === 'number') {
            date = new Date(date);
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    /**
     * 解析JSON字符串
     * @param {string} str JSON字符串
     * @param {*} defaultValue 默认值
     * @returns {*}
     */
    static parseJSON(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.log(`JSON解析失败: ${e.message}`);
            return defaultValue;
        }
    }

    /**
     * 深拷贝对象
     * @param {*} obj 要拷贝的对象
     * @returns {*}
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    /**
     * 读取文件
     * @param {string} filePath 文件路径
     * @param {string} defaultValue 默认值
     * @returns {string}
     */
    static readFile(filePath, defaultValue = '') {
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf8');
            }
            return defaultValue;
        } catch (e) {
            console.log(`读取文件失败 ${filePath}: ${e.message}`);
            return defaultValue;
        }
    }

    /**
     * 写入文件
     * @param {string} filePath 文件路径
     * @param {string} content 文件内容
     * @returns {boolean}
     */
    static writeFile(filePath, content) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        } catch (e) {
            console.log(`写入文件失败 ${filePath}: ${e.message}`);
            return false;
        }
    }

    /**
     * 检查文件是否存在
     * @param {string} filePath 文件路径
     * @returns {boolean}
     */
    static fileExists(filePath) {
        return fs.existsSync(filePath);
    }

    /**
     * 获取环境变量
     * @param {string} key 环境变量名
     * @param {string} defaultValue 默认值
     * @returns {string}
     */
    static getEnv(key, defaultValue = '') {
        return process.env[key] || defaultValue;
    }

    /**
     * 日志输出
     * @param {string} message 日志消息
     * @param {string} level 日志级别
     */
    static log(message, level = 'INFO') {
        const timestamp = this.formatTime();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * 错误日志
     * @param {string} message 错误消息
     */
    static error(message) {
        this.log(message, 'ERROR');
    }

    /**
     * 调试日志
     * @param {string} message 调试消息
     */
    static debug(message) {
        if (this.getEnv('DEBUG') === 'true') {
            this.log(message, 'DEBUG');
        }
    }

    /**
     * 成功日志
     * @param {string} message 成功消息
     */
    static success(message) {
        this.log(message, 'SUCCESS');
    }

    /**
     * 警告日志
     * @param {string} message 警告消息
     */
    static warn(message) {
        this.log(message, 'WARN');
    }

    /**
     * 签到启动随机延时
     * 避免所有用户同时执行签到，分散服务器压力
     * @returns {Promise<number>} 延时时间（秒）
     */
    static async randomStartDelay() {
        const enableRandomStart = this.getEnv('RANDOM_START_ENABLED', 'true') === 'true';
        if (!enableRandomStart) {
            return 0;
        }

        // 默认随机延时范围：0-30分钟（1800秒）
        const minDelay = parseInt(this.getEnv('RANDOM_START_MIN', '0'));
        const maxDelay = parseInt(this.getEnv('RANDOM_START_MAX', '1800'));

        if (minDelay >= maxDelay) {
            this.warn('随机延时配置错误，跳过随机延时');
            return 0;
        }

        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
        if (delay > 0) {
            const minutes = Math.floor(delay / 60);
            const seconds = delay % 60;
            let timeStr = '';
            if (minutes > 0) {
                timeStr += `${minutes}分`;
            }
            if (seconds > 0) {
                timeStr += `${seconds}秒`;
            }
            
            this.log(`⏰ 签到随机延时: ${timeStr} (${delay}秒)`);
            this.log(`⏰ 预计开始时间: ${new Date(Date.now() + delay * 1000).toLocaleString()}`);
            
            await this.wait(delay * 1000);
        }

        return delay;
    }

    /**
     * 获取随机的Cron表达式
     * 用于避免所有任务在相同时间点执行
     * @param {number} baseHour 基础小时数
     * @param {boolean} randomMinutes 是否随机分钟
     * @param {boolean} randomSeconds 是否随机秒数
     * @returns {string} Cron表达式
     */
    static getRandomCron(baseHour = 9, randomMinutes = true, randomSeconds = true) {
        let minute = 0;
        let second = 0;
        
        if (randomMinutes) {
            minute = Math.floor(Math.random() * 60); // 0-59分钟
        }
        
        if (randomSeconds) {
            second = Math.floor(Math.random() * 60); // 0-59秒
        }

        return `${second} ${minute} ${baseHour} * * *`;
    }

    /**
     * 生成多个随机Cron表达式
     * 用于不同平台的签到任务分散执行
     * @param {number} count 生成数量
     * @param {number} baseHour 基础小时数
     * @param {number} hourRange 小时范围
     * @returns {Array<string>} Cron表达式数组
     */
    static generateRandomCrons(count = 5, baseHour = 9, hourRange = 2) {
        const crons = [];
        
        for (let i = 0; i < count; i++) {
            const hour = baseHour + Math.floor(Math.random() * hourRange);
            const minute = Math.floor(Math.random() * 60);
            const second = Math.floor(Math.random() * 60);
            
            crons.push(`${second} ${minute} ${hour} * * *`);
        }
        
        return crons;
    }

    /**
     * 生成随机Cron时间建议
     * 为不同平台提供错开的执行时间建议
     * @returns {Object} 包含各平台建议时间的对象
     */
    static generateCronSuggestions() {
        return {
            smzdm: this.getRandomCron(8, true, true),      // 什么值得买 8点随机
            tieba: this.getRandomCron(9, true, true),      // 百度贴吧 9点随机
            ikuuu: this.getRandomCron(10, true, true),     // IKuuu机场 10点随机
            enshan: this.getRandomCron(8, true, true),     // 恩山论坛 8点随机
            quark: this.getRandomCron(9, true, true),      // 夸克网盘 9点随机
            iqiyi: this.getRandomCron(7, true, true),      // 爱奇艺 7点随机
            weibo: this.getRandomCron(8, true, true)       // 微博 8点随机
        };
    }
}

module.exports = CommonUtils;