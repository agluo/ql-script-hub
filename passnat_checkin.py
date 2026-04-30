# -*- coding: utf-8 -*-
"""
cron "18 0 * * *" script-path=passnat_checkin.py,tag=匹配cron用
new Env('PassNAT签到')
"""

import os
import time
import random
import requests
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

# ---------------- 配置项 ----------------
BASE_URL = "https://api.passnat.com"
max_random_delay = int(os.getenv("MAX_RANDOM_DELAY", "3600"))
random_signin = os.getenv("RANDOM_SIGNIN", "true").lower() == "true"

# ---------------- 工具函数 ----------------
def format_time_remaining(seconds):
    """格式化剩余时间显示"""
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


def wait_with_countdown(delay_seconds, account_name):
    """带倒计时的随机延迟等待"""
    if delay_seconds <= 0:
        return
    print(f"  {account_name} 需要等待 {format_time_remaining(delay_seconds)}")
    remaining = delay_seconds
    while remaining > 0:
        if remaining <= 10 or remaining % 30 == 0:
            print(f"  {account_name} 倒计时: {format_time_remaining(remaining)}")
        sleep_time = 1 if remaining <= 10 else min(10, remaining)
        time.sleep(sleep_time)
        remaining -= sleep_time


def bytes_to_readable(n):
    """字节数转可读格式"""
    if not n or n == "":
        return "0 B"
    n = int(n)
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if abs(n) < 1024.0:
            return f"{n:.2f} {unit}"
        n /= 1024.0
    return f"{n:.2f} PB"


# ---------------- API 请求 ----------------
def get_user_info(secret_key):
    """获取用户信息"""
    headers = {
        "Authorization": secret_key,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    }
    try:
        resp = requests.get(
            f"{BASE_URL}/user/userInfo",
            headers=headers,
            timeout=15,
        )
        return resp.json()
    except Exception as e:
        return {"code": -1, "msg": f"请求异常: {e}", "data": None}


def do_checkin(secret_key):
    """执行签到"""
    headers = {
        "Authorization": secret_key,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    }
    try:
        resp = requests.get(
            f"{BASE_URL}/user/checkIn",
            headers=headers,
            timeout=15,
        )
        return resp.json()
    except Exception as e:
        return {"code": -1, "msg": f"请求异常: {e}", "data": ""}


# ---------------- 单账号签到流程 ----------------
def run_checkin(account_index, secret_key):
    """执行单个账号的签到流程"""
    name = f"账号{account_index}"
    print(f"\n{'='*40}")
    print(f"  {name} 开始签到")
    print(f"  当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*40}")

    # 1. 执行签到
    print(f"  [{name}] 正在签到...")
    checkin_resp = do_checkin(secret_key)
    checkin_code = checkin_resp.get("code", -1)
    checkin_msg = checkin_resp.get("msg", "")
    checkin_data = checkin_resp.get("data", "")

    # 判断签到结果
    if checkin_code == 10000:
        status = "✅ 签到成功"
        checkin_traffic = bytes_to_readable(checkin_data) if checkin_data else "未知"
        checkin_detail = f"获得流量: {checkin_traffic}"
    elif checkin_code == 6001:
        status = "ℹ️ 今日已签到"
        checkin_detail = ""
    else:
        status = f"❌ 签到失败 (code={checkin_code})"
        checkin_detail = ""

    print(f"  [{name}] {status}")
    if checkin_detail:
        print(f"  [{name}] {checkin_detail}")
    elif checkin_msg and checkin_code not in [10000, 6001]:
        print(f"  [{name}] {checkin_msg}")

    # 2. 获取用户信息
    print(f"  [{name}] 正在获取用户信息...")
    user_resp = get_user_info(secret_key)

    if user_resp.get("code") != 10000:
        msg = user_resp.get("msg", "未知错误")
        print(f"  [{name}] ❌ 获取用户信息失败: {msg}")
        if hadsend:
            try:
                send("PassNAT 签到失败", f"{name} 获取用户信息失败：{msg}")
            except Exception as e:
                print(f"  发送通知失败: {e}")
        return

    user_data = user_resp["data"]
    personal = user_data.get("personal_info", {})
    plan = user_data.get("plan_info", {})
    region = personal.get("last_login_region", {})

    print(f"  [{name}] ✅ 用户信息获取成功")
    print(f"  [{name}] 套餐: {plan.get('plan_name', 'N/A')}")

    # 3. 组装通知内容
    lines = [
        f"【签到结果】{status}",
    ]

    # 签到详情（成功显示流量，已签到显示原因）
    if checkin_detail:
        lines.append(f"  {checkin_detail}")
    elif checkin_msg and checkin_code not in [10000, 6001]:
        lines.append(f"  {checkin_msg}")

    lines.extend([
        "",
        "【登录地区】",
        f"  国家: {region.get('country', 'N/A')}",
        f"  省份: {region.get('province', 'N/A')}",
        f"  城市: {region.get('city', 'N/A')}",
        f"  运营商: {region.get('ISP', 'N/A')}",
        f"  IP: {region.get('IP', 'N/A')}",
        "",
        "【套餐信息】",
        f"  套餐名称: {plan.get('plan_name', 'N/A')}",
        f"  套餐流量: {bytes_to_readable(plan.get('plan_traffic', 0))}",
        f"  总计流量: {bytes_to_readable(int(plan.get('plan_traffic', 0)) + int(plan.get('addon_traffic', 0)))}",
        f"  已用流量: {bytes_to_readable(plan.get('used_traffic', 0))}",
        f"  剩余流量: {bytes_to_readable(int(plan.get('plan_traffic', 0)) + int(plan.get('addon_traffic', 0)) - int(plan.get('used_traffic', 0)))}",
        f"  签到流量: {bytes_to_readable(plan.get('check_in_traffic', 0))}",
        f"  附加流量: {bytes_to_readable(plan.get('addon_traffic', 0))}",
        f"  隧道数量: {plan.get('tunnel_count', 0)} / {plan.get('tunnel_limit', 0)}",
    ])

    # 套餐状态
    plan_status_map = {1: "正常", 0: "已过期"}
    ps = plan.get("plan_status")
    if ps is not None:
        lines.append(f"  套餐状态: {plan_status_map.get(ps, '未知')}")

    # 到期时间
    expire_ts = plan.get("expire_date")
    if expire_ts:
        try:
            expire_dt = datetime.fromtimestamp(expire_ts / 1000)
            lines.append(f"  到期时间: {expire_dt.strftime('%Y-%m-%d %H:%M:%S')}")
        except Exception:
            pass

    notification_msg = "\n".join(lines)
    print(f"\n{notification_msg}")

    # 4. 发送通知
    if hadsend:
        try:
            send("PassNAT 签到", notification_msg)
            print(f"  [{name}] 📩 通知已发送")
        except Exception as e:
            print(f"  [{name}] 发送通知失败: {e}")

    print(f"  [{name}] 签到流程完成\n")


# ---------------- 主流程 ----------------
if __name__ == "__main__":
    print("=" * 50)
    print("  PassNAT 签到脚本")
    print(f"  当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    # 读取环境变量，支持多账号（换行分隔）
    all_keys = os.getenv("PASSNAT_SK", "")
    key_list = all_keys.replace("\r\n", "\n").split("\n")
    key_list = [k.strip() for k in key_list if k.strip()]

    if not key_list:
        print("❌ 未找到 PASSNAT_SK 环境变量，请先配置")
        exit(1)

    print(f"共发现 {len(key_list)} 个账号")
    print(f"随机延迟: {'启用' if random_signin else '禁用'}")
    if random_signin:
        print(f"随机延迟窗口: {format_time_remaining(max_random_delay)}")

    # 生成签到计划
    signin_plan = []
    for i, sk in enumerate(key_list):
        account_index = i + 1
        delay = random.randint(0, max_random_delay) if random_signin else 0
        signin_plan.append({
            "index": account_index,
            "sk": sk,
            "delay": delay,
        })

    # 按延迟排序
    if random_signin:
        signin_plan.sort(key=lambda x: x["delay"])
        print("\n==== 签到计划 ====")
        for item in signin_plan:
            t = format_time_remaining(item["delay"])
            print(f"  账号{item['index']}: 延迟 {t}")

    # 执行签到
    print(f"\n{'='*50}")
    print("  开始执行签到任务")
    print(f"{'='*50}")

    for item in signin_plan:
        if item["delay"] > 0:
            wait_with_countdown(item["delay"], f"账号{item['index']}")
        run_checkin(item["index"], item["sk"])

    print(f"\n{'='*50}")
    print("  所有账号签到完成")
    print(f"  完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}")
