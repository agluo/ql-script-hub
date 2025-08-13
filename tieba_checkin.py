#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""
cron "20 9 * * *" script-path=xxx.py,tag=匹配cron用
new Env('百度贴吧签到')
"""

import hashlib
import json
import os
import random
import re
import time
from datetime import datetime, timedelta
from typing import Optional, Union
import requests

# ---------------- 统一通知模块加载（和其他脚本一样）----------------
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

class Tieba:
    name = "百度贴吧"

    def __init__(self, cookie: str, index: int = 1):
        self.index = index
        self.TBS_URL = "http://tieba.baidu.com/dc/common/tbs"
        self.LIKE_URL = "http://c.tieba.baidu.com/c/f/forum/like"
        self.SIGN_URL = "http://c.tieba.baidu.com/c/c/forum/sign"
        self.LOGIN_INFO_URL = "https://zhidao.baidu.com/api/loginInfo"
        self.USER_INFO_URL = "https://tieba.baidu.com/mo/q/checkurl"
        self.SIGN_KEY = "tiebaclient!!!"

        self.HEADERS = {
            "Host": "tieba.baidu.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Connection": "keep-alive",
            "Accept-Encoding": "gzip, deflate",
            "Cache-Control": "no-cache",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        }

        self.SIGN_DATA = {
            "_client_type": "2",
            "_client_version": "9.7.8.0",
            "_phone_imei": "000000000000000",
            "model": "MI+5",
            "net_type": "1",
        }

        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

        if not cookie:
            raise ValueError("必须提供 BDUSS 或完整 Cookie")

        # 解析Cookie
        cookie_dict = {}
        for item in cookie.split(";"):
            item = item.strip()
            if "=" in item:
                key, value = item.split("=", 1)
                cookie_dict[key.strip()] = value.strip()
        
        requests.utils.add_dict_to_cookiejar(self.session.cookies, cookie_dict)
        self.bduss = cookie_dict.get("BDUSS", "")
        if not self.bduss:
            raise ValueError("Cookie 中未找到 BDUSS")

        print(f"👤 账号{self.index}: 初始化成功")

    def request(
        self, url: str, method: str = "get", data: Optional[dict] = None, retry: int = 3
    ) -> dict:
        for i in range(retry):
            try:
                if method.lower() == "get":
                    response = self.session.get(url, timeout=15)
                else:
                    response = self.session.post(url, data=data, timeout=15)

                response.raise_for_status()
                if not response.text.strip():
                    raise ValueError("空响应内容")

                return response.json()

            except Exception as e:
                if i == retry - 1:
                    raise Exception(f"请求失败: {str(e)}")

                wait_time = 1.5 * (2**i) + random.uniform(0.5, 1.5)
                print(f"请求失败，{wait_time:.1f}秒后重试...")
                time.sleep(wait_time)

        raise Exception(f"请求失败，已达最大重试次数 {retry}")

    def encode_data(self, data: dict) -> dict:
        s = ""
        for key in sorted(data.keys()):
            s += f"{key}={data[key]}"
        sign = hashlib.md5((s + self.SIGN_KEY).encode("utf-8")).hexdigest().upper()
        data.update({"sign": sign})
        return data

    def get_user_info(self) -> tuple[Union[str, bool], str]:
        try:
            print("正在验证登录状态...")
            result = self.request(self.TBS_URL)
            if result.get("is_login", 0) == 0:
                return False, "登录失败，Cookie 异常"
            
            tbs = result.get("tbs", "")
            
            # 改进用户名获取逻辑
            user_name = "贴吧用户"  # 默认用户名
            
            # 方法1: 尝试从知道API获取
            try:
                user_info = self.request(self.LOGIN_INFO_URL)
                if user_info.get("userName"):
                    user_name = user_info["userName"]
                    print(f"✅ 登录成功，用户: {user_name}")
                    return tbs, user_name
            except Exception as e:
                print(f"知道API获取用户名失败: {e}")
            
            # 方法2: 尝试从贴吧主页获取
            try:
                main_page = self.session.get("https://tieba.baidu.com/", timeout=10)
                # 查找用户名的几种可能格式
                patterns = [
                    r'"user_name":"([^"]*)"',
                    r'PageData\.user\.name\s*=\s*"([^"]*)"',
                    r'un=([^&\s]+)',
                    r'"name":"([^"]*)".*?"type":"user"'
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, main_page.text)
                    if match and match.group(1):
                        user_name = match.group(1)
                        if user_name not in ["null", "undefined", ""]:
                            break
                        
            except Exception as e:
                print(f"主页获取用户名失败: {e}")
            
            # 方法3: 尝试从BDUSS解析用户ID（最后的备用方案）
            if user_name == "贴吧用户":
                try:
                    # BDUSS通常包含用户信息，可以尝试解析
                    import base64
                    decoded = base64.b64decode(self.bduss + "==")  # 添加padding
                    decoded_str = decoded.decode('utf-8', errors='ignore')
                    # 查找可能的用户名模式
                    name_match = re.search(r'["\']?name["\']?\s*:\s*["\']([^"\']+)["\']', decoded_str)
                    if name_match:
                        user_name = name_match.group(1)
                    else:
                        # 使用BDUSS前8位作为标识
                        user_name = f"用户_{self.bduss[:8]}"
                except Exception:
                    user_name = f"贴吧账号{self.index}"
            
            print(f"✅ 登录成功，用户: {user_name}")
            return tbs, user_name
            
        except Exception as e:
            return False, f"登录验证异常: {e}"

    def get_favorite(self) -> list[dict]:
        print("正在获取关注的贴吧列表...")
        forums = []
        page_no = 1

        while True:
            data = {
                "BDUSS": self.bduss,
                "_client_type": "2",
                "_client_id": "wappc_1534235498291_488",
                "_client_version": "9.7.8.0",
                "_phone_imei": "000000000000000",
                "from": "1008621y",
                "page_no": str(page_no),
                "page_size": "200",
                "model": "MI+5",
                "net_type": "1",
                "timestamp": str(int(time.time())),
                "vcode_tag": "11",
            }
            data = self.encode_data(data)

            try:
                res = self.request(self.LIKE_URL, "post", data)

                if "forum_list" in res:
                    for forum_type in ["non-gconforum", "gconforum"]:
                        if forum_type in res["forum_list"]:
                            items = res["forum_list"][forum_type]
                            if isinstance(items, list):
                                forums.extend(items)
                            elif isinstance(items, dict):
                                forums.append(items)

                if res.get("has_more") != "1":
                    break

                page_no += 1
                time.sleep(random.uniform(1, 2))

            except Exception as e:
                print(f"❌ 获取贴吧列表出错: {e}")
                break

        print(f"📝 共获取到 {len(forums)} 个关注的贴吧")
        return forums

    def sign_forums(self, forums, tbs: str) -> dict:
        success_count, error_count, exist_count, shield_count = 0, 0, 0, 0
        total = len(forums)
        print(f"🎯 开始签到 {total} 个贴吧")
        print("=" * 60)
        
        last_request_time = time.time()
        for idx, forum in enumerate(forums):
            # 签到间隔控制
            elapsed = time.time() - last_request_time
            delay = max(0, 1.0 + random.uniform(0.5, 1.5) - elapsed)
            if delay > 0:
                time.sleep(delay)
            last_request_time = time.time()
            
            # 每10个贴吧显示进度并休息一下
            if (idx + 1) % 10 == 0:
                completed = idx + 1
                progress = (completed / total) * 100
                print(f"📊 签到进度: {completed}/{total} ({progress:.1f}%)")
                extra_delay = random.uniform(3, 8)
                print(f"💤 休息 {extra_delay:.1f} 秒...")
                time.sleep(extra_delay)

            forum_name = forum.get("name", "")
            forum_id = forum.get("id", "")
            log_prefix = f"📋 【{forum_name}】吧({idx + 1}/{total})"

            try:
                data = self.SIGN_DATA.copy()
                data.update(
                    {
                        "BDUSS": self.bduss,
                        "fid": forum_id,
                        "kw": forum_name,
                        "tbs": tbs,
                        "timestamp": str(int(time.time())),
                    }
                )
                data = self.encode_data(data)
                result = self.request(self.SIGN_URL, "post", data)
                error_code = result.get("error_code", "")
                
                if error_code == "0":
                    success_count += 1
                    if "user_info" in result and "user_sign_rank" in result["user_info"]:
                        rank = result["user_info"]["user_sign_rank"]
                        print(f"✅ {log_prefix} 签到成功，第{rank}个签到")
                    else:
                        print(f"✅ {log_prefix} 签到成功")
                elif error_code == "160002":
                    exist_count += 1
                    print(f"📅 {log_prefix} {result.get('error_msg', '今日已签到')}")
                elif error_code == "340006":
                    shield_count += 1
                    print(f"🚫 {log_prefix} 贴吧已被屏蔽")
                else:
                    error_count += 1
                    print(f"❌ {log_prefix} 签到失败，错误: {result.get('error_msg', '未知错误')}")

            except Exception as e:
                error_count += 1
                print(f"❌ {log_prefix} 签到异常: {str(e)}")

        # 显示最终进度
        if total > 0:
            print(f"📊 签到进度: {total}/{total} (100.0%)")
        
        print("=" * 60)
        print(f"📊 === 签到统计汇总 ===")
        print(f"📋 贴吧总数: {total}")
        print(f"✅ 签到成功: {success_count}")
        print(f"📅 已经签到: {exist_count}")
        print(f"🚫 被屏蔽的: {shield_count}")
        print(f"❌ 签到失败: {error_count}")
        print("=" * 60)
        
        return {
            "total": total,
            "success": success_count,
            "exist": exist_count,
            "shield": shield_count,
            "error": error_count,
        }

    def main(self) -> str:
        try:
            print(f"\n==== 账号{self.index} 开始签到 ====")
            print(f"🕐 开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            # 验证登录状态
            tbs, user_name = self.get_user_info()
            if not tbs:
                error_msg = f"❌ 账号{self.index}: {user_name}"
                print(error_msg)
                return error_msg
            
            # 获取关注的贴吧
            forums = self.get_favorite()

            if not forums:
                error_msg = f"❌ 账号{self.index}: {user_name}\n获取贴吧列表失败，无法完成签到"
                print(error_msg)
                return error_msg
            
            # 开始签到
            start_time = time.time()
            stats = self.sign_forums(forums, tbs)
            end_time = time.time()
            duration = int(end_time - start_time)
            
            # 计算签到效率
            total_actions = stats["success"] + stats["exist"]
            efficiency = f"{total_actions}/{stats['total']}" if stats['total'] > 0 else "0/0"
            
            # 格式化结果消息
            result_msg = f"""🎯 百度贴吧签到结果

👤 账号信息: {user_name}
📊 贴吧总数: {stats["total"]}
✅ 签到成功: {stats["success"]}
📅 已经签到: {stats["exist"]}
🚫 被屏蔽的: {stats["shield"]}
❌ 签到失败: {stats["error"]}
📈 签到效率: {efficiency} ({((total_actions/stats['total'])*100 if stats['total'] > 0 else 0):.1f}%)
⏱️ 用时: {duration}秒
🕐 完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"""

            print(f"\n🎉 === 最终签到结果 ===")
            print(result_msg)
            print(f"==== 账号{self.index} 签到完成 ====\n")
            
            return result_msg
                
        except Exception as e:
            error_msg = f"❌ 账号{self.index}: 签到异常 - {str(e)}"
            print(error_msg)
            return error_msg

def main():
    """主程序入口"""
    print(f"==== 百度贴吧签到开始 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")
    
    # 随机延迟（整体延迟）
    if random_signin:
        delay_seconds = random.randint(0, max_random_delay)
        if delay_seconds > 0:
            signin_time = datetime.now() + timedelta(seconds=delay_seconds)  # 修复：datetime.当前() -> datetime.now()
            print(f"🎲 随机模式: 延迟 {format_time_remaining(delay_seconds)} 后开始")
            print(f"⏰ 预计开始时间: {signin_time.strftime('%H:%M:%S')}")
            wait_with_countdown(delay_seconds, "百度贴吧签到")
    
    # 获取Cookie配置
    tieba_cookie = os.getenv("TIEBA_COOKIE", "")  # 修复：中文逗号 -> 英文逗号
    
    if not tieba_cookie:
        error_msg = "❌ 未找到TIEBA_COOKIE环境变量，请设置百度贴吧Cookie"
        print(error_msg)
        notify_user("百度贴吧签到失败", error_msg)
        return

    # 支持多账号（用换行分隔）
    cookies = [cookie.strip() for cookie in tieba_cookie.split('\n') if cookie.strip()]
    print(f"📝 共发现 {len(cookies)} 个账号")
    
    all_results = []
    success_accounts = 0
    
    for index, cookie in enumerate(cookies):  # 修复：在 -> in
        try:
            # 账号间随机等待
            if index > 0:
                delay = random.uniform(10, 30)
                print(f"💤 随机等待 {delay:.1f} 秒后处理下一个账号...")
                time.sleep(delay)
            
            # 执行签到
            tieba = Tieba(cookie, index + 1)
            result = tieba.main()
            all_results.append(result)
            
            # 判断是否成功
            is_success = "签到成功" in result and "❌" not in result  # 修复：在 -> in
            if is_success:
                success_accounts += 1
            
            # 发送单个账号通知
            title = f"百度贴吧账号{index + 1}签到{'成功' if is_success else '失败'}"
            notify_user(title, result)
            
        except Exception as e:
            error_msg = f"❌ 账号{index + 1}: 初始化失败 - {str(e)}"
            print(error_msg)
            all_results.append(error_msg)
            notify_user(f"百度贴吧账号{index + 1}签到失败", error_msg)
    
    # 发送汇总通知
    if len(cookies) > 1:
        summary_msg = f"""🎯 百度贴吧签到汇总

📊 总计处理: {len(cookies)}个账号
✅ 成功账号: {success_accounts}个
❌ 失败账号: {len(cookies) - success_accounts}个
📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  

详细结果请查看各账号单独通知"""
        notify_user('百度贴吧签到汇总', summary_msg)
        print(f"\n📊 === 汇总统计 ===")
        print(summary_msg)
    
    print(f"\n==== 百度贴吧签到完成 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")

if __name__ == "__main__":
    main()
