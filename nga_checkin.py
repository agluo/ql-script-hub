import requests
import os
import time
import random

def send_notification(title, content):
    """
    直接调用青龙 QLAPI.notify 发送通知。
    """
    try:
        QLAPI.notify(title, content)
        print("通知已通过 QLAPI 发送。")
    except Exception as e:
        print(f"通过 QLAPI 发送通知失败: {e}")

def nga_get(session, lib, act, uid, accesstoken, ua, other=None, verbose=False):
    """
    通用的 NGA API 请求函数
    """
    url = "https://ngabbs.com/nuke.php"

    payload = f"access_uid={uid}&access_token={accesstoken}&app_id=1010&__act={act}&__lib={lib}&__output=11"
    if other:
        payload += f"&{other}"

    headers = {
        "User-Agent": ua,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    }

    try:
        response = session.post(url, data=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        if verbose:
            print(f"    操作 {lib}/{act} 的服务器响应: {data}")
        else:
            print(f"    操作 {lib}/{act} 完成: {data.get('time') or data.get('code') or data}")
        return data
    except requests.exceptions.RequestException as e:
        print(f"请求错误: {e}")
        return {"error": ["请求接口出错"]}
    except ValueError: # JSONDecodeError
        print(f"响应不是有效的JSON: {response.text}")
        return {"error": ["响应解析出错"]}

def run_tasks_for_account(uid, accesstoken, ua):
    """
    为单个账户执行所有签到和任务，并返回结果摘要。
    """
    with requests.Session() as session:
        print(f"--- 开始为用户 {uid} 执行任务 ---")
        msg = [f"帐号: {uid}"]

        # 1. 签到
        check_in_res = nga_get(session, "check_in", "check_in", uid, accesstoken, ua)
        if check_in_res and "data" in check_in_res:
            msg.append(f"  签到: 成功, {check_in_res['data'][0]}")
        elif check_in_res and "error" in check_in_res:
            error_msg = check_in_res['error'][0]
            msg.append(f"  签到: 失败, {error_msg}")
            if "登录" in str(error_msg) or "CLIENT" in str(error_msg):
                print(f"--- 用户 {uid} 任务结束 ---\n")
                return msg
        else:
             msg.append("  签到: 失败, 未知错误")
             print(f"--- 用户 {uid} 任务结束 ---\n")
             return msg

        print("\n开始执行日常任务...")
        nga_get(session, "mission", "checkin_count_add", uid, accesstoken, ua, "mid=2&get_success_repeat=1&no_compatible_fix=1")
        nga_get(session, "mission", "checkin_count_add", uid, accesstoken, ua, "mid=131&get_success_repeat=1&no_compatible_fix=1")
        nga_get(session, "mission", "checkin_count_add", uid, accesstoken, ua, "mid=30&get_success_repeat=1&no_compatible_fix=1")
        
        print("\n开始执行看视频任务(免广告)... 注意: 此过程会很慢，请耐心等待")
        nga_get(session, "mission", "video_view_task_counter_add_v2_for_adfree_sp1", uid, accesstoken, ua, verbose=True)
        for i in range(4):
            delay = random.randint(30, 45)
            print(f"  免广告任务第 {i+1}/4 次，等待 {delay} 秒...")
            time.sleep(delay)
            nga_get(session, "mission", "video_view_task_counter_add_v2_for_adfree", uid, accesstoken, ua, verbose=True)
        
        print("\n开始执行看视频得N币任务...")
        for i in range(5):
            delay = random.randint(30, 45)
            print(f"  N币任务第 {i+1}/5 次，等待 {delay} 秒...")
            time.sleep(delay)
            nga_get(session, "mission", "video_view_task_counter_add_v2", uid, accesstoken, ua, verbose=True)

        print("\n开始执行分享任务...")
        tid = random.randint(12345678, 24692245)
        for _ in range(5):
            nga_get(session, "data_query", "topic_share_log_v2", uid, accesstoken, ua, f"event=4&tid={tid}")
            time.sleep(1)
        
        print("领取分享奖励...")
        nga_get(session, "mission", "check_mission", uid, accesstoken, ua, "mid=149&get_success_repeat=1&no_compatible_fix=1")

        print("\n查询最终资产...")
        stats_res = nga_get(session, "check_in", "get_stat", uid, accesstoken, ua)
        if stats_res and "data" in stats_res:
            sign_info, money_info, y_info = stats_res['data']
            msg.append(f"  连签: {sign_info.get('continued', 'N/A')} 天, 累签: {sign_info.get('sum', 'N/A')} 天")
            msg.append(f"  资产: {money_info.get('money_n', 'N/A')} N币, {money_info.get('money', 'N/A')} 铜币")
        else:
            msg.append("  资产查询失败")

        print(f"--- 用户 {uid} 任务结束 ---\n")
        return msg

def main():
    """
    主函数，读取环境变量并为所有账户执行任务
    """
    credentials_str = os.environ.get("NGA_CREDENTIALS")
    ua = os.environ.get("NGA_UA", "Nga_Official/90409")

    if not credentials_str:
        msg = "错误：未找到 NGA_CREDENTIALS 环境变量。请在青龙面板中配置。"
        print(msg)
        send_notification("NGA签到任务失败", msg)
        return

    accounts = credentials_str.split('&')
    print(f"检测到 {len(accounts)} 个账户，即将开始执行...")

    full_notify_msg = []
    for i, account_str in enumerate(accounts):
        if not account_str:
            continue
        try:
            uid, accesstoken = account_str.split(',')
            account_summary = run_tasks_for_account(uid.strip(), accesstoken.strip(), ua)
            full_notify_msg.extend(account_summary)
        except ValueError:
            error_msg = f"第 {i+1} 个账户凭证格式错误: '{account_str}'，应为 'UID,AccessToken'。已跳过。"
            print(error_msg)
            full_notify_msg.append(error_msg)
        finally:
            full_notify_msg.append("-" * 20) # 为每个账户添加分隔符
    
    # 发送最终的通知
    final_summary = "\n".join(full_notify_msg)
    send_notification("NGA签到任务报告", final_summary)

if __name__ == "__main__":
    main()
