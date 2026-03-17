"""
cron: 39 17 * * *
new Env('什么值得买签到')
"""

import requests, json, time, hashlib, os, random, re
from datetime import datetime, timedelta

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

def get_user_info(cookie):
    """获取用户基本信息"""
    try:
        print("👤 正在获取用户信息...")
        infourl = 'https://zhiyou.smzdm.com/user/'
        headers = {
            'Host': 'zhiyou.smzdm.com',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148/smzdm 10.4.6 rv:130.1 (iPhone 13; iOS 15.6; zh_CN)/iphone_smzdmapp/10.4.6/wkwebview/jsbv_1.0.0',
            'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
            'Referer': 'https://m.smzdm.com/',
            'Accept-Encoding': 'gzip, deflate, br'
        }
        
        response_info = requests.get(url=infourl, headers=headers, timeout=15).text
        
        # 解析用户信息
        name_match = re.search(r'<a href="https://zhiyou.smzdm.com/user"> (.*?) </a>', response_info)
        level_match = re.search(r'<img src=".*?/level/(\d+).png.*?"', response_info)
        gold_match = re.search(r'<div class="assets-part assets-gold">.*?<span class="assets-part-element assets-num">(.*?)</span>', response_info, re.S)
        silver_match = re.search(r'<div class="assets-part assets-prestige">.*?<span class="assets-part-element assets-num">(.*?)</span>', response_info, re.S)
        
        name = name_match.group(1).strip() if name_match else "未知用户"
        level = level_match.group(1) if level_match else "0"
        gold = gold_match.group(1).strip() if gold_match else "0"
        silver = silver_match.group(1).strip() if silver_match else "0"
        
        print(f"👤 用户: {name} (VIP{level})")
        print(f"💰 金币: {gold}, 🪙 碎银: {silver}")
        
        return name, level, gold, silver
    except Exception as e:
        print(f"❌ 获取用户信息失败: {e}")
        return "未知用户", "0", "0", "0"

def get_monthly_exp(cookie):
    """获取本月经验"""
    try:
        print("📊 正在获取本月经验...")
        current_month = datetime.now().strftime('%Y-%m')
        total_exp = 0
        
        for page in range(1, 4):  # 查询前3页
            url = f'https://zhiyou.m.smzdm.com/user/exp/ajax_log?page={page}'
            headers = {
                'Host': 'zhiyou.m.smzdm.com',
                'Accept': 'application/json, text/plain, */*',
                'Connection': 'keep-alive',
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148/smzdm 10.4.40 rv:137.6 (iPhone 13; iOS 15.6; zh_CN)/iphone_smzdmapp/10.4.40/wkwebview/jsbv_1.0.0',
                'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
                'Referer': 'https://zhiyou.m.smzdm.com/user/exp/',
                'Accept-Encoding': 'gzip, deflate, br'
            }
            
            resp = requests.get(url=url, headers=headers, timeout=10)
            if resp.status_code != 200:
                break
                
            result = resp.json()
            rows = result.get('data', {}).get('rows', [])
            
            if not rows:
                break
                
            for row in rows:
                exp_date = row.get('creation_date', '')[:7]
                if exp_date == current_month:
                    total_exp += int(row.get('add_exp', 0))
                elif exp_date < current_month:
                    # 如果日期小于当前月份，说明已经查完了
                    return total_exp
            
            # 添加请求间隔
            time.sleep(random.uniform(0.5, 1.5))
        
        print(f"📊 本月经验: {total_exp}")
        return total_exp
    except Exception as e:
        print(f"❌ 获取月度经验失败: {e}")
        return 0

def smzdm_signin(cookie, index):
    """什么值得买签到 - 单个账号"""
    print(f"\n==== 开始第{index}个帐号签到 ====")
    
    try:
        # 0. 获取用户信息
        name, level, gold, silver = get_user_info(cookie)
        
        # 1. 获取Token
        print("🤖 正在获取Token...")
        ts = int(round(time.time() * 1000))
        url = 'https://user-api.smzdm.com/robot/token'
        headers = {
            'Host': 'user-api.smzdm.com',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie,
            'User-Agent': 'smzdm_android_V10.4.1 rv:841 (22021211RC;Android12;zh)smzdmapp',
        }
        data = {
            "f": "android",
            "v": "10.4.1",
            "weixin": 1,
            "time": ts,
            "sign": hashlib.md5(bytes(f'f=android&time={ts}&v=10.4.1&weixin=1&key=apr1$AwP!wRRT$gJ/q.X24poeBInlUJC', encoding='utf-8')).hexdigest().upper()
        }
        
        html = requests.post(url=url, headers=headers, data=data, timeout=15)
        
        # 检查HTTP状态码
        if html.status_code != 200:
            error_msg = f"❌ 账号{index}: HTTP请求失败，状态码: {html.status_code}"
            print(error_msg)
            return error_msg, False
        
        # 尝试解析JSON
        try:
            result = html.json()
        except json.JSONDecodeError as e:
            error_msg = f"❌ 账号{index}: 响应不是有效的JSON格式 - {str(e)}"
            print(error_msg)
            return error_msg, False
        
        # 检查API返回的错误码
        error_code = result.get('error_code')
        error_msg_api = result.get('error_msg', '未知错误')
        
        if str(error_code) != "0":
            error_msg = f"❌ 账号{index}: Token获取失败 - 错误码: {error_code}, 错误信息: {error_msg_api}"
            print(error_msg)
            return error_msg, False
        
        # 检查是否有data字段和token
        if 'data' not in result or 'token' not in result['data']:
            error_msg = f"❌ 账号{index}: 响应中缺少token数据 - {result}"
            print(error_msg)
            return error_msg, False
            
        token = result['data']['token']
        print(f"✅ Token获取成功")

        # 2. 执行签到
        print("🎯 正在执行签到...")
        Timestamp = int(round(time.time() * 1000))
        sign_data = {
            "f": "android",
            "v": "10.4.1",
            "sk": "ierkM0OZZbsuBKLoAgQ6OJneLMXBQXmzX+LXkNTuKch8Ui2jGlahuFyWIzBiDq/L",
            "weixin": 1,
            "time": Timestamp,
            "token": token,
            "sign": hashlib.md5(bytes(f'f=android&sk=ierkM0OZZbsuBKLoAgQ6OJneLMXBQXmzX+LXkNTuKch8Ui2jGlahuFyWIzBiDq/L&time={Timestamp}&token={token}&v=10.4.1&weixin=1&key=apr1$AwP!wRRT$gJ/q.X24poeBInlUJC', encoding='utf-8')).hexdigest().upper()
        }
        
        # 签到请求
        url_signin = 'https://user-api.smzdm.com/checkin'
        html_signin = requests.post(url=url_signin, headers=headers, data=sign_data, timeout=15)
        
        if html_signin.status_code != 200:
            error_msg = f"❌ 账号{index}: 签到HTTP请求失败，状态码: {html_signin.status_code}"
            print(error_msg)
            return error_msg, False
        
        try:
            signin_result = html_signin.json()
        except json.JSONDecodeError as e:
            error_msg = f"❌ 账号{index}: 签到响应不是有效的JSON格式 - {str(e)}"
            print(error_msg)
            return error_msg, False
        
        signin_msg = signin_result.get('error_msg', '签到状态未知')
        signin_code = signin_result.get('error_code', -1)
        print(f"🎯 签到状态: {signin_msg}")
        
        # 3. 获取签到奖励
        print("🎁 正在查询签到奖励...")
        url_reward = 'https://user-api.smzdm.com/checkin/all_reward'
        html_reward = requests.post(url=url_reward, headers=headers, data=sign_data, timeout=15)
        
        reward_info = ""
        if html_reward.status_code == 200:
            try:
                reward_result = html_reward.json()
                
                if str(reward_result.get('error_code')) == "0" and reward_result.get('data'):
                    normal_reward = reward_result["data"].get("normal_reward", {})
                    if normal_reward:
                        reward_content = normal_reward.get("reward_add", {}).get("content", "无奖励")
                        sub_title = normal_reward.get("sub_title", "无连续签到信息")
                        reward_info = f"\n🎁 签到奖励: {reward_content}\n📅 连续签到: {sub_title}"
                        print(f"🎁 签到奖励: {reward_content}")
                        print(f"📅 连续签到: {sub_title}")
            except Exception as e:
                print(f"⚠️ 奖励信息解析失败: {e}")
        else:
            print(f"⚠️ 奖励查询失败，状态码: {html_reward.status_code}")
        
        # 4. 获取本月经验
        monthly_exp = get_monthly_exp(cookie)
        
        # 5. 组合结果消息
        final_msg = f"""什么值得买签到结果

👤 账号: 第{index}个账号 ({name})
⭐ 等级: VIP{level}
💰 金币: {gold}
🪙 碎银: {silver}
📊 本月经验: {monthly_exp}

🎯 签到状态: {signin_msg}
📊 状态码: {signin_code}{reward_info}

🕐 签到时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""
        
        # 判断是否成功
        is_success = (str(signin_code) == "0" or 
                     "成功" in signin_msg or 
                     "已经" in signin_msg or 
                     "重复" in signin_msg or
                     "已签" in signin_msg)
        
        print(f"{'✅ 签到成功' if is_success else '❌ 签到失败'}")
        return final_msg, is_success

    except requests.exceptions.Timeout:
        error_msg = f"❌ 账号{index}: 请求超时，网络连接可能有问题"
        print(error_msg)
        return error_msg, False
    except requests.exceptions.ConnectionError:
        error_msg = f"❌ 账号{index}: 网络连接错误，无法连接到服务器"
        print(error_msg)
        return error_msg, False
    except Exception as e:
        error_msg = f"❌ 账号{index}: 签到异常 - {str(e)}"
        print(error_msg)
        return error_msg, False

def main():
    """主程序入口"""
    print(f"==== 什么值得买签到开始 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")
    
    # 随机延迟（整体延迟）
    if random_signin:
        delay_seconds = random.randint(0, max_random_delay)
        if delay_seconds > 0:
            signin_time = datetime.now() + timedelta(seconds=delay_seconds)
            print(f"🎲 随机模式: 延迟 {format_time_remaining(delay_seconds)} 后开始")
            print(f"⏰ 预计开始时间: {signin_time.strftime('%H:%M:%S')}")
            wait_with_countdown(delay_seconds, "什么值得买签到")

    # 获取环境变量
    SMZDM_COOKIE_env = os.getenv("SMZDM_COOKIE")
    
    if not SMZDM_COOKIE_env:
        error_msg = "❌ 未找到SMZDM_COOKIE环境变量，请设置什么值得买Cookie"
        print(error_msg)
        notify_user("什么值得买签到失败", error_msg)
        return

    # 解析多账号Cookie（使用换行符分割，支持Cookie中包含&符号）
    SMZDM_COOKIEs = [c.strip() for c in SMZDM_COOKIE_env.replace('\r\n', '\n').split('\n') if c.strip()]
    print(f"📝 共发现 {len(SMZDM_COOKIEs)} 个账号")
    
    success_count = 0
    total_count = len(SMZDM_COOKIEs)
    
    for i, cookie in enumerate(SMZDM_COOKIEs):
        try:
            # 账号间随机等待
            if i > 0:
                delay = random.uniform(5, 15)
                print(f"⏱️  随机等待 {delay:.1f} 秒后处理下一个账号...")
                time.sleep(delay)
            
            # 执行签到
            result_msg, is_success = smzdm_signin(cookie.strip(), i + 1)
            
            if is_success:
                success_count += 1
            
            # 发送单个账号通知
            title = f"什么值得买账号{i + 1}签到{'成功' if is_success else '失败'}"
            notify_user(title, result_msg)
            
        except Exception as e:
            error_msg = f"❌ 账号{i + 1}: 处理异常 - {str(e)}"
            print(error_msg)
            notify_user(f"什么值得买账号{i + 1}签到失败", error_msg)
    
    # 发送汇总通知
    if total_count > 1:
        summary_msg = f"""什么值得买签到汇总

📊 总计处理: {total_count}个账号
✅ 签到成功: {success_count}个账号
❌ 签到失败: {total_count - success_count}个账号
📈 成功率: {success_count/total_count*100:.1f}%
🕐 完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""
        
        notify_user("什么值得买签到汇总", summary_msg)
    
    print(f"\n==== 什么值得买签到完成 - 成功{success_count}/{total_count} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")

if __name__ == "__main__":
    main()
