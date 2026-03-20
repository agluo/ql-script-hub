# -*- coding: utf-8 -*-
"""
 cron: 30 6 * * *
 new Env('HiFiNi签到')
 来源: https://github.com/anduinnn/HiFiNi-Auto-CheckIn
 支持 HiFiTi 和 HiFiHi 平台的自动签到、消息推送
"""

import os
import re
import time
import random
import requests

# ---------------- 统一通知模块加载 ----------------
hadsend = False
send = None

try:
    from notify import send
    hadsend = True
    print("✅ 已加载notify.py通知模块")
except ImportError:
    print("⚠️ 未加载通知模块，跳过通知功能")

# ---------------- 随机延迟配置 ----------------
max_random_delay = int(os.getenv("MAX_RANDOM_DELAY", "3600"))
random_signin = os.getenv("RANDOM_SIGNIN", "true").lower() == "true"


def format_time_remaining(seconds):
    """格式化时间显示"""
    if seconds <= 0:
        return "立即执行"
    hours, minutes = divmod(seconds, 3600)
    minutes, secs = divmod(minutes, 60)
    if hours > 0:
        return f"{hours}小时{minutes}分{secs}秒"
    elif minutes > 0:
        return f"{minutes}分{secs}秒"
    else:
        return f"{secs}秒"


def wait_with_countdown(delay_seconds, task_name):
    """带倒计时的随机延迟等待"""
    if delay_seconds <= 0:
        return
    print(f"{task_name} 需要等待 {format_time_remaining(delay_seconds)}")
    remaining = delay_seconds
    while remaining > 0:
        if remaining <= 10 or remaining % 10 == 0:
            print(f"{task_name} 倒计时: {format_time_remaining(remaining)}")
        sleep_time = 1 if remaining <= 10 else min(10, remaining)
        time.sleep(sleep_time)
        remaining -= sleep_time


def notify_user(title, content):
    """统一通知函数"""
    if hadsend:
        try:
            send(title, content)
            print(f"✅ 通知发送完成: {title}")
        except Exception as e:
            print(f"❌ 通知发送失败: {e}")
    else:
        print(f"📢 {title}\n📄 {content}")


class HifiniCheckIn:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        self.results = []

        # Cookie 解析 - 使用换行分隔多账号
        # HiFiTi_COOKIE 对应原来项目的 COOKIE
        HiFiTi_COOKIE_env = os.getenv("HiFiTi_COOKIE", "")
        HIFIHI_COOKIE_env = os.getenv("HIFIHI_COOKIE", "")

        self.cookies = [c.strip() for c in HiFiTi_COOKIE_env.replace('\r\n', '\n').split('\n') if c.strip()]
        self.hifihi_cookies = [c.strip() for c in HIFIHI_COOKIE_env.replace('\r\n', '\n').split('\n') if c.strip()]

        # 统计
        self.success_count = 0
        self.fail_count = 0
        self.total_accounts = len(self.cookies) + len(self.hifihi_cookies)

    def parse_user_id(self, cookie):
        """从Cookie中提取用户ID"""
        match = re.search(r"cloudmusic\.net=([^;]+)", cookie)
        if match:
            return match.group(1)[:8]
        # 备用: 尝试从cookie值本身提取
        if "=" in cookie:
            value = cookie.split("=")[1].split(";")[0]
            if len(value) > 8:
                return value[:8]
        return "unknown"

    def get_formhash(self, url, referer):
        """获取表单哈希值"""
        try:
            self.session.headers["Referer"] = referer
            response = self.session.get(url, timeout=15)
            # 尝试多种formhash匹配模式
            patterns = [
                r'name="formhash" value="([^"]+)"',
                r'formhash=([a-zA-Z0-9]+)',
                r'"formhash":"([^"]+)"',
            ]
            for pattern in patterns:
                match = re.search(pattern, response.text)
                if match:
                    return match.group(1)
        except Exception as e:
            print(f"获取formhash失败: {e}")
        return ""

    def sign_hifiti(self, cookie):
        """HiFiTi 签到"""
        self.session.headers["Referer"] = "https://www.hifiti.com/"
        
        # 设置Cookie
        try:
            cookie_value = cookie.split("=")[1].split(";")[0] if "=" in cookie else cookie
            self.session.cookies.set("cloudmusic.net", cookie_value)
        except:
            pass

        # 先访问首页获取formhash
        formhash = self.get_formhash("https://www.hifiti.com/", "https://www.hifiti.com/")
        if not formhash:
            return False, "获取formhash失败"

        try:
            response = self.session.post(
                "https://www.hifiti.com/plugin.php?id=sign",
                data={
                    "formhash": formhash,
                    "submit": "1"
                },
                timeout=15
            )
            
            response_text = response.text
            
            if "签到成功" in response_text:
                return True, "签到成功"
            elif "已签到" in response_text or "您今日签到已领取" in response_text:
                return False, "今日已签到"
            elif "签到失败" in response_text:
                return False, "签到失败"
            else:
                # 尝试解析返回的消息
                msg_match = re.search(r'(?<!已)签到[^\x00-\xff]+', response_text)
                if msg_match:
                    return False, msg_match.group()
                return False, f"签到结果未知: {response.status_code}"
                
        except Exception as e:
            return False, f"签到异常: {str(e)}"

    def sign_hifihi(self, cookie):
        """HiFiHi 签到"""
        self.session.headers["Referer"] = "https://hifihi.com/"
        
        # 先访问首页获取formhash
        formhash = self.get_formhash("https://hifihi.com/", "https://hifihi.com/")
        if not formhash:
            return False, "获取formhash失败"

        try:
            # 设置Cookie
            cookie_value = cookie.split("=")[1].split(";")[0] if "=" in cookie else cookie
            self.session.cookies.set("cloudmusic.net", cookie_value)
            
            response = self.session.post(
                "https://hifihi.com/plugin.php?id=sign",
                data={
                    "formhash": formhash,
                    "submit": "1"
                },
                timeout=15
            )
            
            response_text = response.text
            
            if "签到成功" in response_text:
                return True, "签到成功"
            elif "已签到" in response_text or "您今日签到已领取" in response_text:
                return False, "今日已签到"
            elif "签到失败" in response_text:
                return False, "签到失败"
            else:
                msg_match = re.search(r'(?<!已)签到[^\x00-\xff]+', response_text)
                if msg_match:
                    return False, msg_match.group()
                return False, f"签到结果未知: {response.status_code}"
                
        except Exception as e:
            return False, f"签到异常: {str(e)}"

    def run(self):
        """执行签到任务"""
        print("=" * 50)
        print("开始 HiFiNi 签到任务")
        print("=" * 50)

        # 随机延迟
        if random_signin and self.total_accounts > 1:
            delay_seconds = random.randint(0, min(max_random_delay, 3600))
            if delay_seconds > 0:
                print(f"🎲 随机模式: 延迟 {format_time_remaining(delay_seconds)} 后开始")
                wait_with_countdown(delay_seconds, "HiFiNi签到")

        print(f"📝 共发现 {len(self.cookies)} 个 HiFiTi 账号, {len(self.hifihi_cookies)} 个 HiFiHi 账号")

        # HiFiTi 签到
        if self.cookies:
            print("\n[HiFiTi] 开始签到...")
            for i, cookie in enumerate(self.cookies):
                user_id = self.parse_user_id(cookie)
                print(f" 账号 {i+1}/{len(self.cookies)} ({user_id}): ", end="")
                success, msg = self.sign_hifiti(cookie)
                print(msg)
                self.results.append(f"HiFiTi 账号{i+1}({user_id}): {msg}")
                if success:
                    self.success_count += 1
                else:
                    self.fail_count += 1
                # 账号间随机延迟
                if i < len(self.cookies) - 1:
                    time.sleep(random.uniform(1, 3))
        else:
            print("\n[HiFiTi] 未配置Cookie，跳过")

        # HiFiHi 签到
        if self.hifihi_cookies:
            print("\n[HiFiHi] 开始签到...")
            for i, cookie in enumerate(self.hifihi_cookies):
                user_id = self.parse_user_id(cookie)
                print(f" 账号 {i+1}/{len(self.hifihi_cookies)} ({user_id}): ", end="")
                success, msg = self.sign_hifihi(cookie)
                print(msg)
                self.results.append(f"HiFiHi 账号{i+1}({user_id}): {msg}")
                if success:
                    self.success_count += 1
                else:
                    self.fail_count += 1
                # 账号间随机延迟
                if i < len(self.hifihi_cookies) - 1:
                    time.sleep(random.uniform(1, 3))
        else:
            print("\n[HiFiHi] 未配置Cookie，跳过")

        # 汇总结果
        print("\n" + "=" * 50)
        print("签到结果汇总:")
        for result in self.results:
            print(f" - {result}")

        # 发送通知
        if self.results:
            summary_msg = f"成功: {self.success_count} / 失败: {self.fail_count}\n\n" + "\n".join([f"• {r}" for r in self.results])
            notify_user("HiFiNi 签到汇总", summary_msg)

        print("=" * 50)
        
        # 返回状态码供青龙面板识别
        return 0 if self.fail_count == 0 else 1


if __name__ == "__main__":
    checkin = HifiniCheckIn()
    exit_code = checkin.run()
    exit(exit_code)