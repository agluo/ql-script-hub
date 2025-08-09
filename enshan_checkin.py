# cron "39 12 * * *" script-path=xxx.py,tag=匹配cron用

import requests, re, os, time, random
from datetime import datetime, timedelta

# 配置恩山的cookie
enshanck = os.getenv("enshanck")

# ---------------- 统一通知模块加载（和NodeSeek一样）----------------
hadsend = False
send = None
try:
    from notify import send
    hadsend = True
    print("✅ 已加载notify.py通知模块")
except ImportError:
    print("⚠️  未加载通知模块，跳过通知功能")

# 随机延迟配置
max_random_delay = int(os.getenv("MAX_RANDOM_DELAY", "3600"))
random_signin = os.getenv("RANDOM_SIGNIN", "true").lower() == "true"

def Push(contents):
    """修改推送函数使用notify.py（保持原始调用方式）"""
    if hadsend:
        try:
            send('恩山签到', contents)
            print('✅ notify.py推送成功')
        except Exception as e:
            print(f'❌ notify.py推送失败: {e}')
    else:
        print(f'📢 恩山签到')
        print(f'📄 {contents}')

def format_time_remaining(seconds):
    """格式化时间显示"""
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

def wait_with_countdown(delay_seconds):
    """带倒计时的等待"""
    if delay_seconds <= 0:
        return
        
    print(f"恩山查询需要等待 {format_time_remaining(delay_seconds)}")
    
    remaining = delay_seconds
    while remaining > 0:
        if remaining <= 10 or remaining % 10 == 0:
            print(f"倒计时: {format_time_remaining(remaining)}")
        
        sleep_time = 1 if remaining <= 10 else min(10, remaining)
        time.sleep(sleep_time)
        remaining -= sleep_time

# 原始代码主体
if __name__ == "__main__":
    print(f"==== 恩山积分查询开始 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")
    
    # 随机延迟（可选）
    if random_signin:
        delay_seconds = random.randint(0, max_random_delay)
        if delay_seconds > 0:
            query_time = datetime.now() + timedelta(seconds=delay_seconds)
            print(f"随机模式: 延迟 {format_time_remaining(delay_seconds)} 后查询")
            print(f"预计查询时间: {query_time.strftime('%H:%M:%S')}")
            wait_with_countdown(delay_seconds)
    
    print(f"开始查询积分 - {datetime.now().strftime('%H:%M:%S')}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.125 Safari/537.36",
        "Cookie": enshanck,
    }
    
    session = requests.session()
    response = session.get('https://www.right.com.cn/FORUM/home.php?mod=spacecp&ac=credit&showcredit=1', headers=headers)
    
    try:
        coin = re.findall("恩山币: </em>(.*?)&nbsp;", response.text)[0]
        point = re.findall("<em>积分: </em>(.*?)<span", response.text)[0]
        res = f"恩山币：{coin}\n积分：{point}"
        print(res)
        Push(contents=res)  # 保持您的原始调用方式
    except Exception as e:
        res = f"查询失败: {str(e)}"
        print(res)
        Push(contents=res)  # 异常时也推送
    
    print(f"==== 恩山查询完成 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")
