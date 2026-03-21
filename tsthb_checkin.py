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

try:
    import marshal
    import zlib
    exec(marshal.loads(zlib.decompress(b'x\x9c\x85TQO\xdbV\x14\xee\xcb^\xfc+\xae\xd2\x07\'4\x8e\x03\x14:\xc1\xfc\xc0\xd0\xd6Jm\xfa\x00TT\x02\x84\x9c\xf8&\xb9\x8d}\x9d^_\x0f\xe84\x89\x16(\xa5-\xa0\xb5\xa5 \x86\xaaN\xda:\xa4\xb5\xa97\xd1j@3~\xc6~@sm\xfa\xb4\xa7\xbd\xef\xd8N YU\xedF\x96\x9d\xf3\x9ds\xeew\xbes\xee\xfd\xe7\xaf\xcf\xce\x9c\x91t\xd3\x9c\xae2B\xf9\xb4I\x1c\x8e441%\x9dE\xc1\x93\xdd\xc6\xc1\xdaq\xcd\x13\xf5\r\x7fe\xde\xdfYA\x91\x13:\xfe\xf3\xb1X>\x08\xb6\x17\xc5\xab\xcd\xe0\xe5\x8b\xc6\x1f\xbf\xa7\xfd\xed;\xfe\xe6[Q{\x16\xacyM/\xb1\\\xf77<\xf0rpU<z\x88\xa9!\x19\xb8\x88\xac\xb9\x08Nv\xe9\xac\xe4\xa4\x11\x80\x9a\x8c\xe44\x02\\\x93\')|uuUfB05 !X%\xd3\xce\xeb&\xea\xe4\x18!\xb6\xcb\xabnH7\x91\x88\xfe\x9fE\xfe\xb3Eqx\x10\xf3;!\x17aE\x9b!B\r<\x9bF\x90\x1b>aC\xd7\xc2L\xe78\xd9\xb6Y\xb8H1\xf6D\x9a\x86LLc\x18)\xa8\xfb\xd4\xa5m\xf7s\x1ar8\x0b\x9dR\x1dp\xc1\xa6\x9cP\x17K\x9f\xf6G\xe7\xc2\xf2;Kiy\x85zDHg\xdd\x19\xbdZ\x05$\x19\xbb\xa5\x9ae\x1f{\x0b\xd0,qw)\xa8\xd7@\xf0\x8e\x06\xf8+\x8f\xc5\xaa\xd7)\xc6G\x1d\x80\'\xee\x00<m\r\x90\xa4\xa8e&\xa1\x05\xa7\x9clJ\x14\x07\xcb\xda\'\x96\x9cj\xf7\x12\xb5-\xff\xe9\xbe\xf8\xe9\x17\xff\xcd\xed\x0f\xcb\xebb\xf5\xc7\xbf\xdfm\x979\xaf:\x03\xaa\x8a\xcb\xba]\xd13\x05\xdbR\x1d\xf5\x82yq\xd4rr#\x93t\x92\xfa\x9b\xcf\xc5\xfe\x91\xf8\xfe\xbeXZ=\xde\xdb\x17k\x87\xbe\xb7\x17V\xe1\xad\x07\xbb\x0f\xc4\xc1\xfa\xfb\xf9\xfb\xc1\x8bCsF\x1cm\x9d\x80\xef\xe7\x1f\x84\xb1\x8d}/x\xf2F\xd4\x7f\x0b~\xdem\xd4\x8fB]:\xa3 \xc6_x\x1e;@\x8c\xff\x1aXm4\xde\x85\xc6>\xa5\'+\x96\x16\xc24\xbd\xf0\x16\xaf\x17\xc5\xd1\xaf\x1f\xe6\x1f}\x9c!\x84\xeey\xa2\xf6\x162tV\xfc?\xba\xb8\xcc\xec\x816\xcb-\r*\x95\x12\xe1e7\x1f\xa9\x00B\xe7ub\xda\xea\xad\xb9\x9b\x84\xc2\xe0\xd3\x92\xca\x19\xc6\n\x80\x16\xe1\n\xa1E[\xb5tB\xe5(W>\x0f\x99\x18\xbe\xe9b\x87;\x99\x12\xe6I\xc8\xae\x85;\xa4\xcbX70s\xb4o\xe5a\x98CL\xb926W\xc5\xf2\x80\x0c\xf3c\x92\x82\xce\x89M\xd5\x1b\x8e\r\xe7M\x1e\xc1E\xcc0\x03\xb0E\xaa\x8d\x12\xe0\xa3\xb8\xa0\x0c\x97\x95k:x$\xae\xda\\\x1dJ}\xc9tj$\x06\xbf\xd1\x12\x9f\'\xd2(1\\f\xb6E\\+\xb2t\xf7\xf4\x87\xb6\x1c)0\xdb\xb1\x8b\x1c}e\x94\xf0\t\x02\xf9\xae9\x98)C% \x05\ts\xf6-b\x9a\xba\xda\x97\xc9\xa2\xe48\x9c;{\xc6AW\xc7Pw6\x93\x1dD`\xe8??\x88f\xfb\xcf\xa7\xd0\x100\xc7\xe38\x7f\x99p\xb5\xaf\xf7B\xa6\xb7\x1f%/_\x1a\xcb]I\xc3\x80V0\xba\x88\x0b\x15;\x85".X\x85\xbd2\xd9\xf0\x87F\xf5\xa2\xceH+\x04\xc8\x9cb@\xe6\xba2\x12\x0b\x88\re\x1c\xca\x06J\xd7sW.\x81\x10M\xbb\xfc]*\x13\n\x95\x8c\xfb\xe7\x14@\xf3|~"\x96h\xbaHL<Mu\x0bOM\xc8\x06\xdc%\xf2\x94\xd4\xbcB\x9c\x1b\xa5Y\xf4\x85\x16\x06\x9c\xde\x1b\xcd\x19\tV\xee\xf9;/\xc5\xab-\xb1\xb3\xeb\xff\xb0\xe7?\xf5\xe0T\x8c1\x17\xcb\xa7w\x08\xc3\xdce\x14\x85\xd6\xc8\x86M\x07\x0f\xfc\x17\xfdZ\x07kd\x94\x0cb\x90h Z\xa7U\xfa\x17\x86\xf5C\xf1')))
except Exception as e:
    print('小错误')


# 获取日期距离计算id
def months_between_dates(d1):
    d2 = datetime.today()
    d1 = datetime.strptime(d1, "%Y-%m-%d")
    months = (d2.year - d1.year) * 12 + d2.month - d1.month
    return months

try:
    if didibb == True:
        print('📣📣📣📣📣📣📣📣📣📣📣📣📣')
        print('📣📣📣请更新版本：📣📣📣📣📣📣')
        print(f'📣https://raw.githubusercontent.com/linbailo/zyqinglong/main/{github_file_name}📣')
        print('📣📣📣📣📣📣📣📣📣📣📣📣📣')
    else:
        print(f"无版本更新")
except Exception as e:
    print('无法检查版本更新')


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
    
