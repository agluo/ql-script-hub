"""
塔斯汀汉堡签到

打开微信小程序抓sss-web.tastientech.com里面的user-token(一般在headers里)填到变量tsthbck里面即可

支持多用户运行

多用户用换行隔开（每行一个账号）
export tsthbck=""

来源: https://raw.githubusercontent.com/linbailo/zyqinglong
cron: 55 9 * * *
const $ = new Env("塔斯汀汉堡");
"""

import requests
import re
import os
import time
import json
import random
from datetime import datetime

# ---------------- 统一通知模块加载 ----------------
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

# 用于收集日志的统一日志列表
all_print_list = []

def myprint(msg):
    """统一打印函数，收集日志用于通知"""
    print(msg)
    all_print_list.append(str(msg) + "\n")

#初始化
print('============📣初始化📣============')
#版本
github_file_name = 'tsthb.py'
sjgx = '2025-05-10T21:30:11.000+08:00'
version = '1.46.8'
print(f"版本: {version}")

# 获取日期距离计算id
def months_between_dates(d1):
    d2 = datetime.today()
    d1 = datetime.strptime(d1, "%Y-%m-%d")
    months = (d2.year - d1.year) * 12 + d2.month - d1.month
    return months

#分割变量（使用换行符分割，支持token中包含&符号）
if 'tsthbck' in os.environ:
    tsthbck = [ck.strip() for ck in os.environ.get("tsthbck").replace('\r\n', '\n').split('\n') if ck.strip()]
    print(f'查找到{len(tsthbck)}个账号')
else:
    tsthbck =['']
    print('无tsthbck变量')

def qdsj(ck):
    headers = {'user-token':ck,'version':version,'channel':'1'}
    data = {"shopId":"","birthday":"","gender": 0,"nickName":None,"phone":""}
    dl = requests.post(url='https://sss-web.tastientech.com/api/minic/shop/intelligence/banner/c/list',json=data,headers=headers).json()
    activityId = ''
    # print(dl)
    for i in dl['result']:
        if '每日签到' in i['bannerName']:
            # print(i)
            qd = i['jumpPara']
            activityId = json.loads(qd)['activityId']
            # activityId = re.findall('activityId%2522%253A(.*?)%257D',qd)[0]
            print(f"获取到本月签到代码：{activityId}")
            #activityId = json.loads(qd)['activityId']
        elif '签到' in i['bannerName']:
            # print(i)
            qd = i['jumpPara']
            activityId = json.loads(qd)['activityId']
            # activityId = re.findall('activityId%2522%253A(.*?)%257D',qd)[0]
            print(f"获取到本月签到代码：{activityId}")
            #activityId = json.loads(qd)['activityId']
    return activityId

def yx(ck):
    activityId= ''
    try:
        activityId = qdsj(ck)
    except Exception as e:
        activityId = ''
    if activityId == '':
        danqryid = 59
        d1 = "2025-05-01"
        months = months_between_dates(d1)
        activityId = danqryid + int(months)

    headers = {'user-token':ck,'version':version,'channel':'1'}
    dl = requests.get(url='https://sss-web.tastientech.com/api/intelligence/member/getMemberDetail',headers=headers).json()
    if dl['code'] == 200:
        myprint(f"账号：{dl['result']['phone']}登录成功")
        phone = dl['result']['phone']
        data = {"activityId":activityId,"memberName":"","memberPhone":phone}
        lq = requests.post(url='https://sss-web.tastientech.com/api/sign/member/signV2',json=data,headers=headers).json()
        if lq['code'] == 200:
            if lq['result']['rewardInfoList'][0]['rewardName'] == None:
                myprint(f"签到情况：获得 {lq['result']['rewardInfoList'][0]['point']} 积分")
            else:
                myprint(f"签到情况：获得 {lq['result']['rewardInfoList'][0]['rewardName']}")
        else:
            myprint(f"签到情况：{lq['msg']}")

def main():
    """主程序入口"""
    # 随机延迟（整体延迟，在签到开始前执行）
    if random_signin:
        delay_seconds = random.randint(0, max_random_delay)
        if delay_seconds > 0:
            print(f"🎲 随机延迟: {format_time_remaining(delay_seconds)}")
            wait_with_countdown(delay_seconds, "塔斯汀汉堡签到")
    
    z = 1
    for ck in tsthbck:
        try:
            myprint(f'登录第{z}个账号')
            myprint('----------------------')
            yx(ck)
            myprint('----------------------')
            z = z + 1
        except Exception as e:
            print(e)
            print('未知错误')

if __name__ == '__main__':
    print('====================')
    try:
        main()
    except Exception as e:
        print('未知错误')
    print('====================')
    # 发送统一通知
    notify_user('塔斯汀汉堡签到', ''.join(all_print_list))
