*"""
cron "39 12 * * *" script-path=xxx.py,tag=匹配cron用
new Env('恩山论坛签到')
"""

import os
import re
import requests
import random
import time
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

# 配置项
enshan_cookie = os.environ.get('enshan_cookie', '')
max_random_delay = int(os.getenv("MAX_RANDOM_DELAY", "3600"))
random_signin = os.getenv("RANDOM_SIGNIN", "true").lower() == "true"
privacy_mode = os.getenv("PRIVACY_MODE", "true").lower() == "true"

# 恩山论坛配置
BASE_URL = 'https://www.right.com.cn/FORUM'
CREDIT_URL = f'{BASE_URL}/home.php?mod=spacecp&ac=credit&showcredit=1'
CHECKIN_URL = f'{BASE_URL}/k_misign-sign.html'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
}

def mask_username(username):
    """用户名脱敏处理"""
    if not username:
        return username

    if privacy_mode:
        if len(username) <= 2:
            return '*' * len(username)
        elif len(username) <= 4:
            return username[0] + '*' * (len(username) - 2) + username[-1]
        else:
            return username[0] + '*' * 3 + username[-1]
    return username

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

def parse_cookies(cookie_str):
    """解析Cookie字符串，支持多账号"""
    if not cookie_str:
        return []

    # 先按换行符分割
    lines = cookie_str.strip().split('\n')
    cookies = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 再按&&分割
        parts = line.split('&&')
        for part in parts:
            part = part.strip()
            if part:
                cookies.append(part)

    # 去重并过滤空值
    unique_cookies = []
    for cookie in cookies:
        if cookie and cookie not in unique_cookies:
            unique_cookies.append(cookie)

    return unique_cookies

def extract_number(text):
    """从文本中提取数字"""
    if not text:
        return 0
    try:
        # 移除所有非数字字符，只保留数字
        number_str = re.sub(r'[^\d]', '', str(text))
        return int(number_str) if number_str else 0
    except (ValueError, TypeError):
        return 0

class EnShanSigner:
    name = "恩山论坛"

    def __init__(self, cookie: str, index: int = 1):
        self.cookie = cookie
        self.index = index
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.session.headers['Cookie'] = cookie

        # 用户信息
        self.user_name = None
        self.user_group = None
        self.coin_before = None
        self.point_before = None
        self.contribution = None
        self.coin_after = None
        self.point_after = None
        self.formhash = None
        self.uid = None

    def daily_login(self):
        """每日登录 - 获取formhash和uid"""
        try:
            print("🔐 正在登录获取参数...")
            url = "https://www.right.com.cn/forum/forum.php"

            response = self.session.get(url, timeout=15)
            print(f"🔍 登录响应状态码: {response.status_code}")

            if response.status_code != 200:
                return False, f"登录失败，状态码: {response.status_code}"

            # 提取formhash
            formhash_match = re.search(r'name="formhash"\s+value="([^"]+)"', response.text)
            if formhash_match:
                self.formhash = formhash_match.group(1)
                print(f"✅ 获取formhash成功: {self.formhash}")
            else:
                return False, "未找到formhash参数"

            # 提取uid
            uid_match = re.search(r"discuz_uid\s*=\s*'(\d+)'", response.text)
            if uid_match:
                self.uid = uid_match.group(1)
                print(f"✅ 获取uid成功: {self.uid}")
            else:
                    return False, "未找到uid参数"

            return True, "登录成功"

        except Exception as e:
            return False, f"登录过程发生错误: {e}"

    def get_user_info(self, is_after=False):
        """获取用户信息和积分"""
        try:
            print(f"👤 正在获取{'签到后' if is_after else '签到前'}用户信息...")

            # 添加随机延迟
            time.sleep(random.uniform(2, 5))

            response = self.session.get(url=CREDIT_URL, timeout=15)

            print(f"🔍 用户信息响应状态码: {response.status_code}")

            if response.status_code == 200:
                # 提取积分信息
                coin_match = re.search(r"恩山币: </em>(.*?)&nbsp;", response.text)
                point_match = re.search(r"<em>积分: </em>(.*?)<span", response.text)

                coin = coin_match.group(1).strip() if coin_match else "0"
                point = point_match.group(1).strip() if point_match else "0"

                if is_after:
                    self.coin_after = coin
                    self.point_after = point
                    print(f"💰 签到后 - 恩山币: {coin}, 积分: {point}")
                else:
                    self.coin_before = coin
                    self.point_before = point
                    print(f"💰 签到前 - 恩山币: {coin}, 积分: {point}")

                # 只在第一次获取用户名等信息
                if not is_after:
                    username_patterns = [
                        r'访问我的空间">(.*?)</a>',
                        r'<strong>(.*?)</strong>',
                        r'用户名[：:]\s*([^<\n]+)',
                    ]

                    usergroup_patterns = [
                        r'用户组: (.*?)</a>',
                        r'用户组[：:]\s*([^<\n]+)',
                    ]

                    contribution_patterns = [
                        r'贡献: </em>(.*?) 分',
                        r'贡献[：:]\s*(\d+)',
                    ]

                    # 提取用户名
                    self.user_name = "未知用户"
                    for pattern in username_patterns:
                        match = re.search(pattern, response.text)
                        if match:
                            self.user_name = match.group(1).strip()
                            break

                    # 提取用户组
                    self.user_group = "未知等级"
                    for pattern in usergroup_patterns:
                        match = re.search(pattern, response.text)
                        if match:
                            self.user_group = match.group(1).strip()
                            break

                    # 提取贡献
                    self.contribution = "0"
                    for pattern in contribution_patterns:
                        match = re.search(pattern, response.text)
                        if match:
                            self.contribution = match.group(1).strip()
                            break

                    print(f"👤 用户: {mask_username(self.user_name)}")
                    print(f"🏅 等级: {self.user_group}")
                    print(f"🎯 贡献: {self.contribution}")

                return True, "用户信息获取成功"
            else:
                error_msg = f"获取用户信息失败，状态码: {response.status_code}"
                print(f"❌ {error_msg}")
                return False, error_msg

        except Exception as e:
            error_msg = f"获取用户信息异常: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg

    def perform_checkin(self):
        """执行签到"""
        try:
            print("📝 正在执行签到...")

            if not self.formhash:
                return False, "请先执行登录获取formhash"

            url = "https://www.right.com.cn/forum/plugin.php?id=erling_qd%3Aaction&action=sign"
            headers = {
                "User-Agent": HEADERS["User-Agent"],
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": "https://www.right.com.cn",
                "DNT": "1",
                "Connection": "keep-alive",
                "Referer": "https://www.right.com.cn/forum/erling_qd-sign_in.html",
                "Cookie": self.cookie,
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                "Priority": "u=0",
                "Pragma": "no-cache",
                "Cache-Control": "no-cache"
            }

            data = f"formhash={self.formhash}"

            response = self.session.post(url, headers=headers, data=data, timeout=15)
            print(f"🔍 签到响应状态码: {response.status_code}"

            if response.status_code == 200:
                # 解析JSON响应
                try:
                    result = response.json()
                    if isinstance(result, dict):
                        if result.get('success') or '成功' in str(result.get('message', '')):
                            return True, result.get('message', '签到成功')
                        elif result.get('message'):
                            message = result['message']
                            # 检查是否已签到
                            if '已签到' in message or '已经签到' in message:
                                return True, message
                            else:
                                return False, f"签到失败: {message}"
                except ValueError:
                    return False, "响应格式错误，无法解析JSON"
            else:
                return False, f"签到请求失败，状态码: {response.status_code}"

        except Exception as e:
            return False, f"签到异常: {str(e)}"

    def main(self):
        """主执行函数"""
        print(f"\n==== 恩山论坛账号{self.index} 开始签到 ====")

        if not self.cookie.strip():
            error_msg = """账号配置错误

❌ 错误原因: Cookie为空

🔧 解决方法:
1. 在青龙面板中添加环境变量enshan_cookie
2. 多账号用换行分隔或&&分隔
3. Cookie需要包含完整的登录信息

💡 提示: 请确保Cookie有效且格式正确"""
            print(f"❌ {error_msg}")
            return error_msg, False

        # 1. 获取签到前用户信息
        login_success, login_msg = self.daily_login()
        if not login_success:
            return f"登录失败: {login_msg}", False
        user_success, user_msg = self.get_user_info(is_after=False)
        if not user_success:
            print(f"⚠️ 获取用户信息失败: {user_msg}")

        # 2. 随机等待
        time.sleep(random.uniform(2, 5))

        # 3. 执行签到
        signin_success, signin_msg = self.perform_checkin()

        # 4. 获取签到后用户信息
        time.sleep(random.uniform(2, 4))
        after_success, after_msg = self.get_user_info(is_after=True)

        # 5. 通过积分变化判断签到是否真的成功
        gain_info = ""
        if after_success and self.coin_before and self.coin_after:
            try:
                # 修复：清理数据，移除"币"等文字，只保留数字
                coin_before = extract_number(self.coin_before)
                coin_after = extract_number(self.coin_after)
                point_before = extract_number(self.point_before)
                point_after = extract_number(self.point_after)

                coin_gain = coin_after - coin_before
                point_gain = point_after - point_before

                print(f"📊 积分变化: 恩山币 {coin_before}→{coin_after} (+{coin_gain}), 积分 {point_before}→{point_after} (+{point_gain})")

                if coin_gain > 0 or point_gain > 0:
                    signin_success = True
                    signin_msg = f"签到成功，获得 {coin_gain} 恩山币，{point_gain} 积分"
                    gain_info = f"\n🎁 本次收益: +{coin_gain} 恩山币, +{point_gain} 积分"
                    print(f"✅ 通过积分变化确认签到成功: +{coin_gain} 恩山币, +{point_gain} 积分")
                elif coin_gain == 0 and point_gain == 0:
                    # 积分没变化，可能已经签到过了
                    signin_success = True
                    signin_msg = "今日已签到（积分无变化）"
                    print("📅 积分无变化，今日已签到")
                else:
                    print("⚠️ 积分变化异常，但仍认为签到成功")
                    signin_success = True

            except Exception as e:
                print(f"⚠️ 积分变化计算异常: {e}")
                # 如果积分计算失败，使用原始签到结果
                print("🔄 使用原始签到结果")

        # 6. 组合结果消息
        final_msg = f"""🌟 恩山论坛签到结果

👤 用户: {mask_username(self.user_name)}
🏅 等级: {self.user_group}
💰 恩山币: {self.coin_before} → {self.coin_after or self.coin_before}
📊 积分: {self.point_before} → {self.point_after or self.point_before}
🎯 贡献: {self.contribution} 分{gain_info}

📝 签到: {signin_msg}
⏰ 时间: {datetime.now().strftime('%m-%d %H:%M')}"""

        print(f"{'✅ 任务完成' if signin_success else '❌ 任务失败'}")
        return final_msg, signin_success

def main():
    """主程序入口"""
    print(f"==== 恩山论坛签到开始 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")

    # 显示配置状态
    print(f"🔒 隐私保护模式: {'已启用' if privacy_mode else '已禁用'}")

    # 随机延迟（整体延迟）
    if random_signin:
        delay_seconds = random.randint(0, max_random_delay)
        if delay_seconds > 0:
            print(f"🎲 随机延迟: {format_time_remaining(delay_seconds)}")
            wait_with_countdown(delay_seconds, "恩山论坛签到")

    # 获取Cookie配置
    if not enshan_cookie:
        error_msg = """❌ 未找到enshan_cookie环境变量

🔧 配置方法:
1. enshan_cookie: 恩山论坛Cookie
2. 多账号用换行分隔或&&分隔
3. Cookie需要包含完整的登录信息

示例:
单账号: enshan_cookie=完整的Cookie字符串
多账号: enshan_cookie=cookie1&&cookie2 或换行分隔

💡 提示: 登录恩山论坛后，F12复制完整Cookie"""

        print(error_msg)
        notify_user("恩山论坛签到失败", error_msg)
        return

    # 使用Cookie解析函数
    cookies = parse_cookies(enshan_cookie)

    if not cookies:
        error_msg = """❌ Cookie解析失败

🔧 可能原因:
1. Cookie格式不正确
2. Cookie为空或只包含空白字符
3. 分隔符使用错误

💡 请检查enshan_cookie环境变量的值"""

        print(error_msg)
        notify_user("恩山论坛签到失败", error_msg)
        return

    print(f"📝 共发现 {len(cookies)} 个账号")

    success_count = 0
    total_count = len(cookies)
    results = []

    for index, cookie in enumerate(cookies):
        try:
            # 账号间随机等待
            if index > 0:
                delay = random.uniform(10, 20)
                print(f"⏱️  随机等待 {delay:.1f} 秒后处理下一个账号...")
                time.sleep(delay)

            # 执行签到
            signer = EnShanSigner(cookie, index + 1)
            result_msg, is_success = signer.main()

            if is_success:
                success_count += 1

            results.append({
                'index': index + 1,
                'success': is_success,
                'message': result_msg,
                'username': mask_username(signer.user_name) if signer.user_name else f"账号{index + 1}"
            })

            # 发送单个账号通知
            status = "成功" if is_success else "失败"
            title = f"恩山论坛账号{index + 1}签到{status}"
            notify_user(title, result_msg)

        except Exception as e:
            error_msg = f"账号{index + 1}: 执行异常 - {str(e)}"
            print(f"❌ {error_msg}")
            notify_user(f"恩山论坛账号{index + 1}签到失败", error_msg)

    # 发送汇总通知
    if total_count > 1:
        summary_msg = f"""📊 恩山论坛签到汇总

📈 总计: {total_count}个账号
✅ 成功: {success_count}个
❌ 失败: {total_count - success_count}个
📊 成功率: {success_count/total_count*100:.1f}%
⏰ 完成时间: {datetime.now().strftime('%m-%d %H:%M')}"""

        # 添加详细结果（最多显示5个账号的详情）
        if len(results) <= 5:
            summary_msg += "\n\n📋 详细结果:"
            for result in results:
                status_icon = "✅" if result['success'] else "❌"
                summary_msg += f"\n{status_icon} {result['username']}"

        notify_user("恩山论坛签到汇总", summary_msg)

    print(f"\n==== 恩山论坛签到完成 - 成功{success_count}/{total_count} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")

def handler(event, context):
    """云函数入口"""
    main()

if __name__ == "__main__":
    main()