#!/usr/bin/python3
# -- coding: utf-8 -- 
"""
cron: 0 2 * * *
new Env('恩山签到')
"""

import requests, re, os, time, random
from datetime import datetime, timedelta

# 配置获取
enshanck = os.getenv("enshanck")

# ---------------- 统一通知模块加载 ----------------
hadsend = False
send = None
try:
    from notify import send
    hadsend = True
    print("✅ 已加载notify.py通知模块")
except ImportError:
    print("⚠️  未加载通知模块，跳过通知功能")

# 随机化配置
max_random_delay = int(os.getenv("MAX_RANDOM_DELAY", "3600"))
random_signin = os.getenv("RANDOM_SIGNIN", "true").lower() == "true"

# 固定安全的User-Agent
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

def notify_user(title, content):
    """统一通知函数"""
    if hadsend:
        try:
            send(title, content)
            print(f"✅ 通知发送完成: {title}")
        except Exception as e:
            print(f"❌ 通知发送失败: {e}")
    else:
        print(f"📢 {title}")
        print(f"📄 {content}")

def format_time_remaining(seconds):
    """格式化剩余时间显示"""
    if seconds <= 0:
        return "立即执行"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
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

def random_sleep(min_seconds=1, max_seconds=5):
    """随机短暂等待"""
    delay = random.uniform(min_seconds, max_seconds)
    print(f"随机等待 {delay:.1f} 秒...")
    time.sleep(delay)

def enshan_signin():
    """恩山论坛签到"""
    if not enshanck:
        print("❌ 未配置恩山cookie，无法签到")
        return False, "未配置Cookie，请在环境变量中设置 enshanck"

    print("使用固定User-Agent（安全模式）")
    
    headers = {
        "User-Agent": USER_AGENT,
        "Cookie": enshanck,
        "Referer": "https://www.right.com.cn/FORUM/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
    }
    
    session = requests.Session()
    session.headers.update(headers)
    
    try:
        # 1. 检查登录状态
        random_sleep(1, 3)
        print("正在获取用户信息...")
        response = session.get('https://www.right.com.cn/FORUM/home.php?mod=spacecp&ac=credit&showcredit=1', timeout=15)
        
        if "登录" in response.text or "login" in response.url.lower():
            return False, "Cookie已失效，请重新获取恩山论坛Cookie"
        
        # 解析积分信息
        try:
            coin_before = re.findall(r"恩山币: </em>(.*?)&nbsp;", response.text)[0]
            point_before = re.findall(r"<em>积分: </em>(.*?)<span", response.text)[0]
            print(f"签到前: 恩山币 {coin_before}, 积分 {point_before}")
        except (IndexError, AttributeError):
            return False, "无法解析用户积分信息，请检查Cookie是否正确"
        
        # 2. 执行签到
        random_sleep(2, 5)
        print("正在执行签到...")
        
        signin_url = "https://www.right.com.cn/FORUM/k_misign-sign.html"
        signin_response = session.get(signin_url, timeout=15)
        
        # 检查签到结果
        signin_text = signin_response.text
        if "签到成功" in signin_text or "恭喜" in signin_text:
            status = "✅ 签到成功"
            status_emoji = "🎉"
        elif "已经签到" in signin_text or "重复签到" in signin_text or "今日已签" in signin_text:
            status = "ℹ️ 今天已签到"
            status_emoji = "📅"
        elif "签到失败" in signin_text:
            status = "❌ 签到失败"
            status_emoji = "⚠️"
        else:
            status = "❓ 签到状态未知"
            status_emoji = "❓"
            print(f"签到响应内容片段: {signin_text[:200]}")
        
        # 3. 获取签到后积分信息
        random_sleep(3, 6)
        print("正在获取签到后积分信息...")
        response_after = session.get('https://www.right.com.cn/FORUM/home.php?mod=spacecp&ac=credit&showcredit=1', timeout=15)
        
        try:
            coin_after = re.findall(r"恩山币: </em>(.*?)&nbsp;", response_after.text)[0]
            point_after = re.findall(r"<em>积分: </em>(.*?)<span", response_after.text)[0]
            print(f"签到后: 恩山币 {coin_after}, 积分 {point_after}")
        except (IndexError, AttributeError):
            coin_after, point_after = coin_before, point_before
        
        # 计算收益
        try:
            coin_gain = int(coin_after) - int(coin_before) if coin_after.isdigit() and coin_before.isdigit() else 0
            point_gain = int(point_after) - int(point_before) if point_after.isdigit() and point_before.isdigit() else 0
        except ValueError:
            coin_gain, point_gain = 0, 0
        
        # 格式化结果消息
        gain_info = ""
        if coin_gain > 0 or point_gain > 0:
            gain_info = f"\n🎁 本次收益: +{coin_gain} 恩山币, +{point_gain} 积分"
        
        result = f"""{status_emoji} 恩山论坛签到结果

🎯 签到状态: {status}
💰 恩山币: {coin_before} → {coin_after}
⭐ 积分: {point_before} → {point_after}{gain_info}
🕐 签到时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""
        
        is_success = "签到成功" in status or "已签到" in status
        return is_success, result
        
    except requests.exceptions.Timeout:
        return False, "❌ 请求超时，网络连接异常"
    except requests.exceptions.RequestException as e:
        return False, f"❌ 网络请求失败: {str(e)}"
    except Exception as e:
        return False, f"❌ 签到过程中发生异常: {str(e)}"

if __name__ == "__main__":
    print(f"==== 恩山论坛签到开始 ====")
    print(f"启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 随机延迟执行
    if random_signin:
        delay_seconds = random.randint(0, max_random_delay)
        if delay_seconds > 0:
            signin_time = datetime.now() + timedelta(seconds=delay_seconds)
            print(f"随机签到模式: 延迟 {format_time_remaining(delay_seconds)} 后签到")
            print(f"预计签到时间: {signin_time.strftime('%H:%M:%S')}")
            wait_with_countdown(delay_seconds, "恩山签到")
        else:
            print("随机签到模式: 立即执行")
    
    print(f"\n==== 开始执行恩山签到 ====")
    print(f"当前时间: {datetime.now().strftime('%H:%M:%S')}")
    
    success, message = enshan_signin()
    
    print(f"\n{message}")
    
    # 发送通知
    title = "恩山签到成功" if success else "恩山签到失败"
    notify_user(title, message)
    
    print(f"\n==== 恩山签到任务完成 ====")
    print(f"完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
