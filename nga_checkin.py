#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""
cron "1 17 * * *" script-path=xxx.py,tag=匹配cron用
new Env('NGA论坛签到')
"""

import requests
import os
import time
import random
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

def send_notification(title, content):
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

class NGAUser:
    def __init__(self, uid, accesstoken, ua, index):
        self.uid = uid
        self.accesstoken = accesstoken
        self.ua = ua
        self.index = index
        self.session = requests.Session()
        
    def nga_get(self, lib, act, other=None, verbose=False):
        """通用的 NGA API 请求函数"""
        url = "https://ngabbs.com/nuke.php"

        payload = f"access_uid={self.uid}&access_token={self.accesstoken}&app_id=1010&__act={act}&__lib={lib}&__output=11"
        if other:
            payload += f"&{other}"

        headers = {
            "User-Agent": self.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }

        try:
            response = self.session.post(url, data=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            if verbose:
                print(f"    📡 操作 {lib}/{act} 的服务器响应: {data}")
            else:
                result_info = data.get('time') or data.get('code') or str(data)
                print(f"    ✅ 操作 {lib}/{act} 完成: {result_info}")
            return data
        except requests.exceptions.RequestException as e:
            print(f"    ❌ 请求错误: {e}")
            return {"error": ["请求接口出错"]}
        except ValueError:
            print(f"    ❌ 响应不是有效的JSON: {response.text}")
            return {"error": ["响应解析出错"]}

    def check_in(self):
        """执行签到"""
        print(f"🎯 账号{self.index}: 开始签到")
        check_in_res = self.nga_get("check_in", "check_in")
        
        if check_in_res and "data" in check_in_res:
            sign_msg = check_in_res['data'][0]
            print(f"✅ 账号{self.index}: 签到成功 - {sign_msg}")
            return f"签到成功: {sign_msg}", True, True
        elif check_in_res and "error" in check_in_res:
            error_msg = check_in_res['error'][0]
            
            # 优化判断逻辑：已签到也算成功
            if "已经签到" in str(error_msg) or "今天已经签到了" in str(error_msg):
                print(f"📅 账号{self.index}: 今日已签到 - {error_msg}")
                return f"今日已签到: {error_msg}", True, True  # 已签到算成功
            elif "登录" in str(error_msg) or "CLIENT" in str(error_msg):
                print(f"❌ 账号{self.index}: 登录状态异常 - {error_msg}")
                return f"签到失败: {error_msg} (登录状态异常)", False, False
            else:
                print(f"❌ 账号{self.index}: 签到失败 - {error_msg}")
                return f"签到失败: {error_msg}", False, True  # 其他错误继续执行任务
        else:
            print(f"❌ 账号{self.index}: 签到失败 - 未知错误")
            return "签到失败: 未知错误", False, False

    def daily_missions(self):
        """执行日常任务"""
        print(f"🎯 账号{self.index}: 开始执行日常任务")
        
        missions = [
            ("mid=2", "任务2"),
            ("mid=131", "任务131"), 
            ("mid=30", "任务30")
        ]
        
        completed_missions = []
        for mission_param, mission_name in missions:
            try:
                result = self.nga_get("mission", "checkin_count_add", f"{mission_param}&get_success_repeat=1&no_compatible_fix=1")
                if result and not result.get("error"):
                    completed_missions.append(mission_name)
                    print(f"    ✅ {mission_name} 完成")
                else:
                    print(f"    ⚠️ {mission_name} 可能已完成或失败")
                time.sleep(random.uniform(1, 3))
            except Exception as e:
                print(f"    ❌ {mission_name} 执行异常: {e}")
        
        return completed_missions

    def video_missions(self):
        """执行看视频任务"""
        print(f"🎯 账号{self.index}: 开始执行看视频任务(免广告)")
        print("    ⏰ 此过程较慢，请耐心等待...")
        
        # 免广告任务初始化
        self.nga_get("mission", "video_view_task_counter_add_v2_for_adfree_sp1", verbose=True)
        
        # 执行4次免广告任务
        for i in range(4):
            delay = random.randint(30, 45)
            print(f"    🎬 免广告任务第 {i+1}/4 次，等待 {delay} 秒...")
            time.sleep(delay)
            self.nga_get("mission", "video_view_task_counter_add_v2_for_adfree", verbose=True)
        
        print(f"🎯 账号{self.index}: 开始执行看视频得N币任务")
        # 执行5次N币任务
        for i in range(5):
            delay = random.randint(30, 45)
            print(f"    💰 N币任务第 {i+1}/5 次，等待 {delay} 秒...")
            time.sleep(delay)
            self.nga_get("mission", "video_view_task_counter_add_v2", verbose=True)
        
        return "视频任务完成"

    def share_missions(self):
        """执行分享任务"""
        print(f"🎯 账号{self.index}: 开始执行分享任务")
        
        tid = random.randint(12345678, 24692245)
        for i in range(5):
            print(f"    📤 分享任务第 {i+1}/5 次")
            self.nga_get("data_query", "topic_share_log_v2", f"event=4&tid={tid}")
            time.sleep(random.uniform(1, 2))
        
        print(f"    🎁 领取分享奖励")
        reward_result = self.nga_get("mission", "check_mission", "mid=149&get_success_repeat=1&no_compatible_fix=1")
        
        return "分享任务完成"

    def get_stats(self):
        """查询账户统计信息"""
        print(f"🎯 账号{self.index}: 查询最终资产")
        
        stats_res = self.nga_get("check_in", "get_stat")
        if stats_res and "data" in stats_res:
            try:
                sign_info, money_info, y_info = stats_res['data']
                continued_days = sign_info.get('continued', 'N/A')
                sum_days = sign_info.get('sum', 'N/A')
                n_coins = money_info.get('money_n', 'N/A')
                copper_coins = money_info.get('money', 'N/A')
                
                stats_msg = f"连签: {continued_days}天, 累签: {sum_days}天, N币: {n_coins}, 铜币: {copper_coins}"
                print(f"    💰 {stats_msg}")
                return stats_msg
            except Exception as e:
                print(f"    ❌ 资产信息解析失败: {e}")
                return "资产查询失败"
        else:
            print(f"    ❌ 资产查询失败")
            return "资产查询失败"

    def run_all_tasks(self):
        """执行所有任务并返回结果"""
        print(f"\n==== 账号{self.index} 开始执行 ====")
        print(f"👤 用户ID: {self.uid}")
        print(f"🕐 开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        results = []
        
        # 1. 签到
        sign_result, sign_success, continue_tasks = self.check_in()
        results.append(sign_result)
        
        if not continue_tasks:
            error_msg = f"❌ 账号{self.index}: {self.uid}\n{sign_result}\n无法继续执行其他任务"
            print(error_msg)
            return error_msg, False
        
        try:
            # 2. 日常任务
            daily_results = self.daily_missions()
            if daily_results:
                results.append(f"日常任务: 完成{len(daily_results)}个任务")
            
            # 3. 视频任务
            video_result = self.video_missions()
            results.append(video_result)
            
            # 4. 分享任务
            share_result = self.share_missions()
            results.append(share_result)
            
            # 5. 查询资产
            stats_result = self.get_stats()
            results.append(f"最终资产: {stats_result}")
            
            # 格式化结果
            result_msg = f"""🎮 NGA论坛签到结果

👤 账号信息: {self.uid}
📊 执行结果:
{chr(10).join([f'  • {result}' for result in results])}
🕐 完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""

            print(f"\n🎉 === 最终执行结果 ===")
            print(result_msg)
            print(f"==== 账号{self.index} 执行完成 ====\n")
            
            # 修复成功判断逻辑：签到成功或已签到都算成功
            is_success = sign_success  # 直接使用签到的成功状态
            return result_msg, is_success
            
        except Exception as e:
            error_msg = f"❌ 账号{self.index}: 任务执行异常 - {str(e)}"
            print(error_msg)
            return error_msg, False

def main():
    """主程序入口"""
    print(f"==== NGA论坛签到开始 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")
    
    # 随机延迟
    if random_signin:
        delay_seconds = random.randint(0, max_random_delay)
        if delay_seconds > 0:
            signin_time = datetime.now() + timedelta(seconds=delay_seconds)
            print(f"🎲 随机模式: 延迟 {format_time_remaining(delay_seconds)} 后开始")
            print(f"⏰ 预计开始时间: {signin_time.strftime('%H:%M:%S')}")
            wait_with_countdown(delay_seconds, "NGA论坛签到")
    
    # 获取环境变量
    credentials_str = os.getenv("NGA_CREDENTIALS", "")
    ua = os.getenv("NGA_UA", "Nga_Official/90409")

    if not credentials_str:
        error_msg = "❌ 未找到NGA_CREDENTIALS环境变量，请配置账号信息"
        print(error_msg)
        send_notification("NGA论坛签到失败", error_msg)
        return

    # 解析多账号（使用换行符分割，支持凭证中包含&符号）
    accounts = [acc.strip() for acc in credentials_str.replace('\r\n', '\n').split('\n') if acc.strip()]
    print(f"📝 共发现 {len(accounts)} 个账号")
    
    success_accounts = 0
    all_results = []
    
    for i, account_str in enumerate(accounts):
        try:
            # 账号间随机等待
            if i > 0:
                delay = random.uniform(10, 30)
                print(f"💤 随机等待 {delay:.1f} 秒后处理下一个账号...")
                time.sleep(delay)
            
            # 解析账号信息
            if ',' not in account_str:
                error_msg = f"❌ 账号{i+1}: 凭证格式错误，应为 'UID,AccessToken'"
                print(error_msg)
                all_results.append(error_msg)
                send_notification(f"NGA论坛账号{i+1}签到失败", error_msg)
                continue
            
            uid, accesstoken = account_str.split(',', 1)
            uid = uid.strip()
            accesstoken = accesstoken.strip()
            
            # 执行任务
            nga_user = NGAUser(uid, accesstoken, ua, i + 1)
            result_msg, is_success = nga_user.run_all_tasks()
            all_results.append(result_msg)
            
            if is_success:
                success_accounts += 1
            
            # 发送单个账号通知 - 修复通知标题
            title = f"NGA论坛账号{i+1}签到{'成功' if is_success else '失败'}"
            send_notification(title, result_msg)
            
        except Exception as e:
            error_msg = f"❌ 账号{i+1}: 处理异常 - {str(e)}"
            print(error_msg)
            all_results.append(error_msg)
            send_notification(f"NGA论坛账号{i+1}签到失败", error_msg)
    
    # 发送汇总通知
    if len(accounts) > 1:
        summary_msg = f"""🎮 NGA论坛签到汇总

📊 总计处理: {len(accounts)}个账号
✅ 成功账号: {success_accounts}个
❌ 失败账号: {len(accounts) - success_accounts}个
📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

详细结果请查看各账号单独通知"""
        send_notification('NGA论坛签到汇总', summary_msg)
        print(f"\n📊 === 汇总统计 ===")
        print(summary_msg)
    
    print(f"\n==== NGA论坛签到完成 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")

if __name__ == "__main__":
    main()
