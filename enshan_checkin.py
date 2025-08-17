"""
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
CHECKIN_URL = f'{BASE_URL}/plugin.php?id=dsu_paulsign:sign'
LOG_URL = f'{BASE_URL}/home.php?mod=spacecp&ac=credit&op=log&suboperation=creditrulelog'

# 更真实的浏览器Headers
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
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
        self.coin = None
        self.contribution = None
        self.point = None
        self.last_signin_date = None

    def check_anti_bot(self, response):
        """检查是否遇到反爬虫机制"""
        if response.status_code == 521:
            return True, "遇到Cloudflare防护"
        
        # 检查常见的反爬虫提示
        anti_bot_keywords = [
            '提示信息',
            '访问频率过快',
            '请稍后再试',
            '验证码',
            '人机验证',
            'Cloudflare',
            'Ray ID',
            '安全验证'
        ]
        
        for keyword in anti_bot_keywords:
            if keyword in response.text:
                return True, f"检测到反爬虫机制: {keyword}"
        
        return False, ""

    def get_user_info(self):
        """获取用户信息和积分"""
        try:
            print("👤 正在获取用户信息...")
            
            # 添加随机延迟
            time.sleep(random.uniform(2, 5))
            
            response = self.session.get(url=CREDIT_URL, timeout=15)
            
            print(f"🔍 用户信息响应状态码: {response.status_code}")
            
            # 检查反爬虫
            is_blocked, block_reason = self.check_anti_bot(response)
            if is_blocked:
                error_msg = f"访问被阻止: {block_reason}"
                print(f"🚫 {error_msg}")
                return False, error_msg
            
            if response.status_code == 200:
                # 提取积分信息 - 使用原作者验证的正则表达式
                coin_match = re.search(r"恩山币: </em>(.*?)&nbsp;", response.text)
                point_match = re.search(r"<em>积分: </em>(.*?)<span", response.text)
                
                # 额外提取用户名和其他信息
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
                
                # 提取数据
                self.coin = coin_match.group(1).strip() if coin_match else "0"
                self.point = point_match.group(1).strip() if point_match else "0"
                
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
                print(f"💰 恩山币: {self.coin}")
                print(f"📊 积分: {self.point}")
                print(f"🎯 贡献: {self.contribution}")
                
                return True, "用户信息获取成功"
            else:
                error_msg = f"获取用户信息失败，状态码: {response.status_code}"
                print(f"❌ {error_msg}")
                return False, error_msg
                
        except requests.exceptions.Timeout:
            error_msg = "获取用户信息请求超时"
            print(f"❌ {error_msg}")
            return False, error_msg
        except requests.exceptions.ConnectionError:
            error_msg = "网络连接错误"
            print(f"❌ {error_msg}")
            return False, error_msg
        except Exception as e:
            error_msg = f"获取用户信息异常: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg

    def get_signin_log(self):
        """获取签到日期记录 - 使用正则表达式替代lxml"""
        try:
            print("📅 正在获取签到记录...")
            
            # 添加随机延迟
            time.sleep(random.uniform(2, 4))
            
            response = self.session.get(url=LOG_URL, timeout=15)
            
            print(f"🔍 签到记录响应状态码: {response.status_code}")
            
            # 检查反爬虫
            is_blocked, block_reason = self.check_anti_bot(response)
            if is_blocked:
                error_msg = f"访问被阻止: {block_reason}"
                print(f"🚫 {error_msg}")
                return False, error_msg
            
            if response.status_code == 200:
                # 使用正则表达式提取签到日期
                date_patterns = [
                    r'<td[^>]*>(\d{4}-\d{1,2}-\d{1,2}[^<]*)</td>',
                    r'<td[^>]*>(\d{4}-\d{1,2}-\d{1,2})</td>',
                    r'>(\d{4}-\d{1,2}-\d{1,2}[^<]*)<',
                ]
                
                dates = []
                for pattern in date_patterns:
                    matches = re.findall(pattern, response.text)
                    if matches:
                        dates.extend(matches)
                        break
                
                if dates:
                    # 取最新的日期
                    self.last_signin_date = dates[0].strip()
                    print(f"📅 最后签到时间: {self.last_signin_date}")
                    
                    # 判断今日是否已签到
                    today = datetime.now().strftime('%Y-%m-%d')
                    if today in self.last_signin_date:
                        return True, "今日已签到"
                    else:
                        return False, "今日未签到"
                else:
                    print("⚠️ 未找到签到记录")
                    return False, "未找到签到记录"
            else:
                error_msg = f"获取签到记录失败，状态码: {response.status_code}"
                print(f"❌ {error_msg}")
                return False, error_msg
                
        except Exception as e:
            error_msg = f"获取签到记录异常: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg

    def perform_checkin(self):
        """执行签到"""
        try:
            print("📝 正在执行签到...")
            
            # 添加随机延迟
            time.sleep(random.uniform(3, 6))
            
            # 先获取签到页面获取必要参数
            checkin_page = self.session.get(url=CHECKIN_URL, timeout=15)
            
            print(f"🔍 签到页面响应状态码: {checkin_page.status_code}")
            
            # 检查反爬虫
            is_blocked, block_reason = self.check_anti_bot(checkin_page)
            if is_blocked:
                error_msg = f"签到页面被阻止: {block_reason}"
                print(f"🚫 {error_msg}")
                return False, error_msg
            
            if checkin_page.status_code == 200:
                # 检查是否已经签到
                already_signed_patterns = [
                    r'您今天已经签到过了',
                    r'今日已签到',
                    r'已经签到',
                    r'签到成功',
                ]
                
                for pattern in already_signed_patterns:
                    if re.search(pattern, checkin_page.text):
                        print("📅 今日已签到")
                        return True, "今日已签到"
                
                # 提取formhash等必要参数
                formhash_match = re.search(r'name="formhash" value="([^"]+)"', checkin_page.text)
                
                if formhash_match:
                    formhash = formhash_match.group(1)
                    print(f"🔑 获取到formhash: {formhash[:10]}...")
                    
                    # 添加延迟模拟真实用户行为
                    time.sleep(random.uniform(2, 4))
                    
                    # 执行签到POST请求
                    checkin_data = {
                        'formhash': formhash,
                        'qdxq': 'kx',  # 签到心情：开心
                        'qdmode': '1',
                        'todaysay': '今日签到',
                        'fastreply': '0'
                    }
                    
                    # 更新Referer
                    self.session.headers['Referer'] = CHECKIN_URL
                    
                    response = self.session.post(
                        url=CHECKIN_URL, 
                        data=checkin_data, 
                        timeout=15
                    )
                    
                    print(f"🔍 签到提交响应状态码: {response.status_code}")
                    
                    # 检查反爬虫
                    is_blocked, block_reason = self.check_anti_bot(response)
                    if is_blocked:
                        error_msg = f"签到提交被阻止: {block_reason}"
                        print(f"🚫 {error_msg}")
                        return False, error_msg
                    
                    if response.status_code == 200:
                        success_patterns = [
                            r'签到成功',
                            r'恭喜.*?签到成功',
                            r'签到完成',
                        ]
                        
                        already_patterns = [
                            r'已经签到',
                            r'今日已签到',
                            r'您今天已经签到过了',
                        ]
                        
                        # 检查签到成功
                        for pattern in success_patterns:
                            if re.search(pattern, response.text):
                                print("✅ 签到成功")
                                return True, "签到成功"
                        
                        # 检查已经签到
                        for pattern in already_patterns:
                            if re.search(pattern, response.text):
                                print("📅 今日已签到")
                                return True, "今日已签到"
                        
                        print("❌ 签到失败，返回内容异常")
                        print(f"🔍 响应内容片段: {response.text[:300]}...")
                        return False, "签到失败，可能遇到验证或限制"
                    else:
                        error_msg = f"签到请求失败，状态码: {response.status_code}"
                        print(f"❌ {error_msg}")
                        return False, error_msg
                else:
                    # 如果没有找到formhash，可能是已经签到或者页面结构变化
                    if '签到' in checkin_page.text:
                        print("📅 可能今日已签到")
                        return True, "可能今日已签到"
                    else:
                        print("❌ 未找到签到相关信息")
                        return False, "签到页面异常"
            else:
                error_msg = f"获取签到页面失败，状态码: {checkin_page.status_code}"
                print(f"❌ {error_msg}")
                return False, error_msg
                
        except requests.exceptions.Timeout:
            error_msg = "签到请求超时"
            print(f"❌ {error_msg}")
            return False, error_msg
        except requests.exceptions.ConnectionError:
            error_msg = "网络连接错误"
            print(f"❌ {error_msg}")
            return False, error_msg
        except Exception as e:
            error_msg = f"签到异常: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg

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

        # 1. 获取用户信息
        user_success, user_msg = self.get_user_info()
        if not user_success:
            # 如果是反爬虫阻止，仍然尝试签到
            if "访问被阻止" in user_msg:
                print("⚠️ 用户信息获取被阻止，但仍尝试签到...")
                signin_success, signin_msg = self.perform_checkin()
                
                final_msg = f"""🌟 恩山论坛签到结果

👤 用户: 信息获取受限
🚫 状态: {user_msg}

📝 签到: {signin_msg}
⏰ 时间: {datetime.now().strftime('%m-%d %H:%M')}"""
                
                return final_msg, signin_success
            else:
                return f"获取用户信息失败: {user_msg}", False
        
        # 2. 随机等待
        time.sleep(random.uniform(2, 5))
        
        # 3. 获取签到记录
        log_success, log_msg = self.get_signin_log()
        
        # 4. 如果今日未签到，执行签到
        signin_msg = log_msg
        signin_success = log_success
        
        if not log_success and "访问被阻止" not in log_msg:
            signin_success, signin_result = self.perform_checkin()
            signin_msg = signin_result
        elif "访问被阻止" in log_msg:
            # 如果获取记录被阻止，直接尝试签到
            print("⚠️ 签到记录获取被阻止，直接尝试签到...")
            signin_success, signin_msg = self.perform_checkin()
        
        # 5. 组合结果消息
        final_msg = f"""🌟 恩山论坛签到结果

👤 用户: {mask_username(self.user_name)}
🏅 等级: {self.user_group}
💰 恩山币: {self.coin}
📊 积分: {self.point}
🎯 贡献: {self.contribution} 分

📝 签到: {signin_msg}
📅 最后签到: {self.last_signin_date or '未知'}
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

💡 提示: 登录恩山论坛后，F12复制完整Cookie
⚠️  注意: 恩山论坛有反爬虫机制，建议设置较长的随机延迟"""
        
        print(error_msg)
        notify_user("恩山论坛签到失败", error_msg)
        return
    
    # 使用新的Cookie解析函数
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
    print("⚠️  恩山论坛有反爬虫机制，将使用较长延迟")
    
    # 调试信息：显示Cookie长度（不显示具体内容）
    for i, cookie in enumerate(cookies):
        print(f"🔍 账号{i+1} Cookie长度: {len(cookie)} 字符")
    
    success_count = 0
    total_count = len(cookies)
    results = []
    
    for index, cookie in enumerate(cookies):
        try:
            # 账号间随机等待 - 增加延迟时间
            if index > 0:
                delay = random.uniform(15, 30)  # 增加到15-30秒
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
⚠️  反爬虫: 恩山论坛有防护机制
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
