/**
 * 多平台通知模块
 * 
 * @author agluo
 * @version 1.0.0
 * @description 支持Bark、Server酱、PushPlus、钉钉、企业微信等多种通知方式
 */

const axios = require('axios');
const crypto = require('crypto');
const CommonUtils = require('./common');

class NotifyManager {
    constructor(config = {}) {
        this.config = config;
        this.enabled = config.enabled !== false;
        this.title = config.title || 'QL Script Hub';
    }

    /**
     * 发送通知到所有已启用的平台
     * @param {string} message 通知消息
     * @param {string} title 通知标题
     * @param {object} options 额外选项
     */
    async send(message, title = '', options = {}) {
        if (!this.enabled) {
            CommonUtils.debug('通知功能已禁用');
            return;
        }

        const finalTitle = title || this.title;
        const results = [];

        // 尝试发送到所有启用的通知平台
        const promises = [
            this.sendToBark(message, finalTitle, options),
            this.sendToServerChan(message, finalTitle, options),
            this.sendToPushPlus(message, finalTitle, options),
            this.sendToDingTalk(message, finalTitle, options),
            this.sendToWecom(message, finalTitle, options)
        ];

        const outcomes = await Promise.allSettled(promises);
        outcomes.forEach((outcome, index) => {
            if (outcome.status === 'fulfilled' && outcome.value) {
                results.push(outcome.value);
            } else if (outcome.status === 'rejected') {
                CommonUtils.error(`通知发送失败: ${outcome.reason}`);
            }
        });

        if (results.length > 0) {
            CommonUtils.success(`通知发送成功，共${results.length}个平台`);
        } else {
            CommonUtils.error('所有通知平台发送失败');
        }

        return results;
    }

    /**
     * Bark推送 (iOS)
     * @param {string} message 消息内容
     * @param {string} title 消息标题
     * @param {object} options 额外选项
     */
    async sendToBark(message, title, options = {}) {
        const barkConfig = this.config.bark;
        if (!barkConfig || !barkConfig.enabled || !barkConfig.key) {
            return null;
        }

        try {
            const url = `${barkConfig.url || 'https://api.day.app'}/${barkConfig.key}`;
            const data = {
                title: title,
                body: message,
                icon: options.icon || '',
                sound: options.sound || 'default',
                url: options.url || ''
            };

            const response = await axios.post(url, data, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.code === 200) {
                CommonUtils.debug('Bark推送成功');
                return { platform: 'Bark', success: true };
            } else {
                throw new Error(response.data?.message || '推送失败');
            }
        } catch (error) {
            CommonUtils.error(`Bark推送失败: ${error.message}`);
            return null;
        }
    }

    /**
     * Server酱推送 (微信)
     * @param {string} message 消息内容
     * @param {string} title 消息标题
     * @param {object} options 额外选项
     */
    async sendToServerChan(message, title, options = {}) {
        const serverChanConfig = this.config.serverChan;
        if (!serverChanConfig || !serverChanConfig.enabled || !serverChanConfig.key) {
            return null;
        }

        try {
            const url = `https://sctapi.ftqq.com/${serverChanConfig.key}.send`;
            const data = {
                title: title,
                desp: message
            };

            const response = await axios.post(url, data, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.code === 0) {
                CommonUtils.debug('Server酱推送成功');
                return { platform: 'ServerChan', success: true };
            } else {
                throw new Error(response.data?.message || '推送失败');
            }
        } catch (error) {
            CommonUtils.error(`Server酱推送失败: ${error.message}`);
            return null;
        }
    }

    /**
     * PushPlus推送 (微信)
     * @param {string} message 消息内容
     * @param {string} title 消息标题
     * @param {object} options 额外选项
     */
    async sendToPushPlus(message, title, options = {}) {
        const pushPlusConfig = this.config.pushplus;
        if (!pushPlusConfig || !pushPlusConfig.enabled || !pushPlusConfig.token) {
            return null;
        }

        try {
            const url = 'http://www.pushplus.plus/send';
            const data = {
                token: pushPlusConfig.token,
                title: title,
                content: message,
                template: options.template || 'html'
            };

            const response = await axios.post(url, data, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.code === 200) {
                CommonUtils.debug('PushPlus推送成功');
                return { platform: 'PushPlus', success: true };
            } else {
                throw new Error(response.data?.msg || '推送失败');
            }
        } catch (error) {
            CommonUtils.error(`PushPlus推送失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 钉钉机器人推送
     * @param {string} message 消息内容
     * @param {string} title 消息标题
     * @param {object} options 额外选项
     */
    async sendToDingTalk(message, title, options = {}) {
        const dingTalkConfig = this.config.dingtalk;
        if (!dingTalkConfig || !dingTalkConfig.enabled || !dingTalkConfig.webhook) {
            return null;
        }

        try {
            let url = dingTalkConfig.webhook;
            
            // 如果配置了加签密钥，则生成签名
            if (dingTalkConfig.secret) {
                const timestamp = Date.now();
                const stringToSign = `${timestamp}\n${dingTalkConfig.secret}`;
                const sign = crypto.createHmac('sha256', dingTalkConfig.secret)
                    .update(stringToSign)
                    .digest('base64');
                url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
            }

            const data = {
                msgtype: 'text',
                text: {
                    content: `${title}\n\n${message}`
                }
            };

            const response = await axios.post(url, data, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.errcode === 0) {
                CommonUtils.debug('钉钉推送成功');
                return { platform: 'DingTalk', success: true };
            } else {
                throw new Error(response.data?.errmsg || '推送失败');
            }
        } catch (error) {
            CommonUtils.error(`钉钉推送失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 企业微信应用推送
     * @param {string} message 消息内容
     * @param {string} title 消息标题
     * @param {object} options 额外选项
     */
    async sendToWecom(message, title, options = {}) {
        const wecomConfig = this.config.wecom;
        if (!wecomConfig || !wecomConfig.enabled || !wecomConfig.corpid || !wecomConfig.corpsecret) {
            return null;
        }

        try {
            // 获取access_token
            const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${wecomConfig.corpid}&corpsecret=${wecomConfig.corpsecret}`;
            const tokenResponse = await axios.get(tokenUrl, { timeout: 10000 });
            
            if (!tokenResponse.data || tokenResponse.data.errcode !== 0) {
                throw new Error('获取企业微信access_token失败');
            }

            const accessToken = tokenResponse.data.access_token;

            // 发送消息
            const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;
            const data = {
                touser: wecomConfig.touser || '@all',
                agentid: wecomConfig.agentid,
                msgtype: 'text',
                text: {
                    content: `${title}\n\n${message}`
                }
            };

            const response = await axios.post(sendUrl, data, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.errcode === 0) {
                CommonUtils.debug('企业微信推送成功');
                return { platform: 'Wecom', success: true };
            } else {
                throw new Error(response.data?.errmsg || '推送失败');
            }
        } catch (error) {
            CommonUtils.error(`企业微信推送失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 发送成功通知
     * @param {string} scriptName 脚本名称
     * @param {string} message 成功消息
     */
    async sendSuccess(scriptName, message) {
        const title = `✅ ${scriptName} 执行成功`;
        await this.send(message, title);
    }

    /**
     * 发送失败通知
     * @param {string} scriptName 脚本名称
     * @param {string} error 错误信息
     */
    async sendError(scriptName, error) {
        const title = `❌ ${scriptName} 执行失败`;
        await this.send(error, title);
    }

    /**
     * 发送警告通知
     * @param {string} scriptName 脚本名称
     * @param {string} warning 警告信息
     */
    async sendWarning(scriptName, warning) {
        const title = `⚠️ ${scriptName} 执行警告`;
        await this.send(warning, title);
    }
}

module.exports = NotifyManager;