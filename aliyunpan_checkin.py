#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""
cron: 3 11 * * *
new Env('阿里云盘签到')
"""

import json
import os
import requests
import urllib3
import random
import time
import subprocess
import sqlite3
import hashlib
from datetime import datetime, timedelta

urllib3.disable_warnings()

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
max_random_delay = int(os.getenv("MAX_RANDOM_DELAY", "3600"))
random_signin = os.getenv("RANDOM_SIGNIN", "true").lower() == "true"
auto_update_token = os.getenv("AUTO_UPDATE_TOKEN", "true").lower() == "true"
privacy_mode = os.getenv("PRIVACY_MODE", "true").lower() == "true"  # 隐私模式
show_token_in_notification = os.getenv("SHOW_TOKEN_IN_NOTIFICATION", "false").lower() == "true"  # 通知中是否显示token

def mask_sensitive_data(data, data_type="token"):
    """脱敏处理敏感数据"""
    if not data:
        return "未知"
    
    if data_type == "token":
        if len(data) <= 10:
            return "*" * len(data)
        return f"{data[:6]}...{data[-4:]}"
    elif data_type == "phone":
        if len(data) >= 7:
            return f"{data[:3]}****{data[-4:]}"
        return "***"
    elif data_type == "email":
        if "@" in data:
            parts = data.split("@")
            username = parts[0]
            domain = parts[1]
            if len(username) <= 2:
                masked_username = "*" * len(username)
            else:
                masked_username = f"{username[:2]}{'*' * (len(username) - 2)}"
            return f"{masked_username}@{domain}"
        return "***@***.***"
    else:
        return str(data)

def generate_account_id(token):
    """生成账号唯一标识（用于区分多账号，不暴露真实信息）"""
    if not token:
        return "未知账号"
    # 使用token的MD5值前8位作为账号标识
    hash_obj = hashlib.md5(token.encode())
    return f"账号{hash_obj.hexdigest()[:8].upper()}"

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

def update_qinglong_env_database(var_name, new_value, old_value=None):
    """通过数据库直接更新青龙面板环境变量"""
    try:
        print("🔍 尝试通过数据库更新青龙面板环境变量...")
        
        # 青龙面板数据库路径
        db_paths = [
            "/ql/data/db/database.sqlite",
            "/ql/db/database.sqlite",
            "/ql/data/database.sqlite"
        ]
        
        db_path = None
        for path in db_paths:
            if os.path.exists(path):
                db_path = path
                print(f"📍 找到数据库文件: {path}")
                break
        
        if not db_path:
            print("❌ 未找到青龙面板数据库文件")
            return False
        
        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 先查询表结构
        cursor.execute("PRAGMA table_info(envs)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # 查询现有环境变量
        cursor.execute("SELECT * FROM envs WHERE name = ?", (var_name,))
        existing_env = cursor.fetchone()
        
        if existing_env:
            # 更新现有环境变量（兼容不同版本的字段）
            print(f"🔄 更新现有环境变量: {var_name}")
            if 'updated_at' in columns:
                current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute("UPDATE envs SET value = ?, updated_at = ? WHERE name = ?", 
                             (new_value, current_time, var_name))
            else:
                cursor.execute("UPDATE envs SET value = ? WHERE name = ?", 
                             (new_value, var_name))
        else:
            # 创建新环境变量
            print(f"➕ 创建新环境变量: {var_name}")
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            if 'updated_at' in columns and 'created_at' in columns:
                cursor.execute("""
                    INSERT INTO envs (name, value, created_at, updated_at, status) 
                    VALUES (?, ?, ?, ?, ?)
                """, (var_name, new_value, current_time, current_time, 1))
            else:
                # 简化版本，只插入必要字段
                cursor.execute("INSERT INTO envs (name, value) VALUES (?, ?)", 
                             (var_name, new_value))
        
        # 提交更改
        conn.commit()
        conn.close()
        
        print(f"✅ 成功通过数据库更新环境变量 {var_name}")
        return True
        
    except Exception as e:
        print(f"❌ 数据库更新失败: {e}")
        return False

def update_qinglong_env_api(var_name, new_value, old_value=None):
    """通过青龙面板API更新环境变量"""
    try:
        print("🔍 尝试通过青龙面板API更新环境变量...")
        
        # 查找青龙面板配置文件
        config_paths = [
            "/ql/config/auth.json",
            "/ql/data/config/auth.json",
            "/ql/config/config.json"
        ]
        
        config_data = None
        for config_path in config_paths:
            if os.path.exists(config_path):
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config_data = json.load(f)
                    print(f"📍 找到配置文件: {config_path}")
                    break
                except:
                    continue
        
        if not config_data:
            print("❌ 未找到青龙面板配置文件")
            return False
        
        # 获取API配置
        token = config_data.get('token') or config_data.get('auth', {}).get('token')
        if not token:
            print("❌ 配置文件中未找到token")
            return False
        
        # API基础URL
        api_base = "http://localhost:5700"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # 查询现有环境变量
        print("🔍 查询现有环境变量...")
        response = requests.get(f"{api_base}/api/envs", headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"❌ 查询环境变量失败: {response.status_code}")
            return False
        
        envs_data = response.json()
        if not envs_data.get("code") == 200:
            print(f"❌ API返回错误: {envs_data}")
            return False
        
        existing_env = None
        for env in envs_data.get("data", []):
            if env.get("name") == var_name:
                existing_env = env
                break
        
        if existing_env:
            # 更新现有环境变量
            print(f"🔄 更新现有环境变量: {var_name}")
            env_id = existing_env.get("id") or existing_env.get("_id")
            update_data = {
                "name": var_name,
                "value": new_value,
                "id": env_id
            }
            response = requests.put(f"{api_base}/api/envs", headers=headers, json=update_data, timeout=10)
        else:
            # 创建新环境变量
            print(f"➕ 创建新环境变量: {var_name}")
            create_data = {
                "name": var_name,
                "value": new_value
            }
            response = requests.post(f"{api_base}/api/envs", headers=headers, json=create_data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("code") == 200:
                print(f"✅ 成功通过API更新环境变量 {var_name}")
                return True
            else:
                print(f"❌ API操作失败: {result}")
                return False
        else:
            print(f"❌ API请求失败: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ API更新失败: {e}")
        return False

def update_qinglong_env_cmd(var_name, new_value, old_value=None):
    """使用ql命令更新环境变量"""
    try:
        print("🔍 尝试使用ql命令...")
        
        # 检查是否存在ql命令
        result = subprocess.run(['which', 'ql'], capture_output=True, text=True)
        if result.returncode != 0:
            print("⚠️ 未找到ql命令")
            return False
        
        # 先查询现有环境变量
        print("🔍 查询现有环境变量...")
        cmd_list = ['ql', 'envs', 'ls']
        result = subprocess.run(cmd_list, capture_output=True, text=True, timeout=15)
        
        env_exists = False
        if result.returncode == 0:
            # 检查输出中是否包含目标变量
            if var_name in result.stdout:
                env_exists = True
                print(f"📋 找到现有环境变量: {var_name}")
        
        if env_exists:
            # 更新现有环境变量
            print(f"🔄 更新现有环境变量: {var_name}")
            cmd_update = ['ql', 'envs', 'update', var_name, new_value]
            result = subprocess.run(cmd_update, capture_output=True, text=True, timeout=15)
            
            if result.returncode == 0:
                print(f"✅ 成功更新环境变量 {var_name}")
                return True
            else:
                print(f"❌ 更新失败: {result.stderr}")
                # 如果更新失败，尝试删除后重新添加
                print("🔄 尝试删除后重新添加...")
                subprocess.run(['ql', 'envs', 'rm', var_name], capture_output=True, text=True, timeout=10)
        
        # 添加新环境变量
        print(f"➕ 添加环境变量: {var_name}")
        cmd_add = ['ql', 'envs', 'add', var_name, new_value]
        result = subprocess.run(cmd_add, capture_output=True, text=True, timeout=15)
        
        if result.returncode == 0:
            print(f"✅ 成功添加环境变量 {var_name}")
            return True
        else:
            print(f"❌ 添加失败: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("⚠️ ql命令执行超时")
        return False
    except Exception as e:
        print(f"⚠️ ql命令方法失败: {e}")
        return False

def update_environment_variable(var_name, new_value, old_value=None):
    """更新环境变量（支持多种环境）"""
    if not auto_update_token:
        print("🔧 自动更新Token功能已禁用")
        return False
    
    try:
        print(f"🔄 正在尝试自动更新环境变量 {var_name}...")
        
        # 检查是否在青龙面板环境
        if os.path.exists('/ql'):
            print("🐉 检测到青龙面板环境，尝试多种更新方式...")
            
            # 方法1: 数据库直接更新（最可靠）
            if update_qinglong_env_database(var_name, new_value, old_value):
                return True
            
            # 方法2: API更新
            if update_qinglong_env_api(var_name, new_value, old_value):
                return True
            
            # 方法3: ql命令更新
            if update_qinglong_env_cmd(var_name, new_value, old_value):
                return True
            
            print("❌ 所有青龙面板更新方式都失败了")
            return False
        
        # 检查是否在Docker环境
        elif os.path.exists('/.dockerenv'):
            return update_docker_env(var_name, new_value)
        
        # 其他环境（本地运行等）
        else:
            return update_local_env(var_name, new_value)
            
    except Exception as e:
        print(f"❌ 自动更新环境变量失败: {e}")
        return False

def update_docker_env(var_name, new_value):
    """Docker环境下的处理"""
    try:
        print("🐳 检测到Docker环境...")
        print("💡 Docker环境中的环境变量通常在容器启动时设定")
        
        # 可以尝试写入到临时文件供下次启动使用
        temp_file = f"/tmp/{var_name}.env"
        with open(temp_file, 'w') as f:
            f.write(f"{var_name}={new_value}\n")
        
        print(f"📝 已将新值写入临时文件: {temp_file}")
        return True
        
    except Exception as e:
        print(f"⚠️ Docker环境处理失败: {e}")
        return False

def update_local_env(var_name, new_value):
    """本地环境下的处理"""
    try:
        print("🏠 检测到本地环境...")
        
        # 尝试更新当前进程的环境变量
        os.environ[var_name] = new_value
        print(f"✅ 已更新当前进程的环境变量 {var_name}")
        
        # 尝试写入到 .env 文件
        env_files = ['.env', '.env.local', 'config.env']
        
        for env_file in env_files:
            if os.path.exists(env_file):
                try:
                    # 读取现有内容
                    with open(env_file, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    
                    # 更新或添加变量
                    updated = False
                    new_lines = []
                    
                    for line in lines:
                        if line.strip().startswith(f'{var_name}='):
                            new_lines.append(f'{var_name}={new_value}\n')
                            updated = True
                        else:
                            new_lines.append(line)
                    
                    if not updated:
                        new_lines.append(f'{var_name}={new_value}\n')
                    
                    # 写回文件
                    with open(env_file, 'w', encoding='utf-8') as f:
                        f.writelines(new_lines)
                    
                    print(f"✅ 已更新 {env_file} 文件")
                    return True
                    
                except Exception as e:
                    print(f"⚠️ 更新 {env_file} 失败: {e}")
                    continue
        
        print("💡 未找到 .env 文件，仅更新了当前进程环境变量")
        return True
        
    except Exception as e:
        print(f"⚠️ 本地环境处理失败: {e}")
        return False

class AliYun:
    name = "阿里云盘"

    def __init__(self, refresh_token: str, index: int = 1):
        self.refresh_token = refresh_token
        self.index = index
        self.new_refresh_token = None
        self.account_id = generate_account_id(refresh_token)

    def update_token(self):
        """更新访问令牌"""
        try:
            print("🔄 正在更新访问令牌...")
            if privacy_mode:
                print(f"🔍 Token预览: {mask_sensitive_data(self.refresh_token, 'token')}")
            else:
                print(f"🔍 Token预览: {self.refresh_token[:20]}...{self.refresh_token[-10:]}")
            
            url = "https://auth.aliyundrive.com/v2/account/token"
            data = {"grant_type": "refresh_token", "refresh_token": self.refresh_token}
            
            response = requests.post(url=url, json=data, timeout=15)
            print(f"🔍 响应状态码: {response.status_code}")
            
            if response.status_code != 200:
                try:
                    error_detail = response.json()
                    error_msg = error_detail.get('message', '未知错误')
                    error_code = error_detail.get('code', 'UNKNOWN')
                    
                    if response.status_code == 400:
                        if 'InvalidParameter.RefreshToken' in str(error_detail):
                            return None, "refresh_token无效或已过期，请重新获取"
                        elif 'refresh_token' in str(error_detail).lower():
                            return None, "refresh_token格式错误或已失效"
                        else:
                            return None, f"请求参数错误: {error_msg}"
                    elif response.status_code == 401:
                        return None, "refresh_token已过期，需要重新登录获取"
                    else:
                        return None, f"HTTP {response.status_code}: {error_msg}"
                except:
                    return None, f"HTTP请求失败，状态码: {response.status_code}"
                    
            try:
                result = response.json()
            except:
                return None, "响应不是有效的JSON格式"
                
            access_token = result.get("access_token")
            new_refresh_token = result.get("refresh_token")
            
            if access_token:
                print("✅ 访问令牌更新成功")
                
                # 检查是否有新的refresh_token
                if new_refresh_token and new_refresh_token != self.refresh_token:
                    if privacy_mode:
                        print(f"🔄 检测到新的refresh_token: {mask_sensitive_data(new_refresh_token, 'token')}")
                    else:
                        print(f"🔄 检测到新的refresh_token: {new_refresh_token[:20]}...{new_refresh_token[-10:]}")
                    
                    self.new_refresh_token = new_refresh_token
                    
                    # 尝试自动更新环境变量
                    if auto_update_token:
                        print("🤖 正在尝试自动更新环境变量...")
                        success = update_environment_variable("ALIYUN_REFRESH_TOKEN", new_refresh_token, self.refresh_token)
                        
                        if success:
                            print("✅ 环境变量自动更新成功")
                            # 更新当前实例的token
                            self.refresh_token = new_refresh_token
                        else:
                            print("⚠️ 环境变量自动更新失败，请手动更新")
                            if not privacy_mode:
                                print(f"💡 请手动设置: ALIYUN_REFRESH_TOKEN={new_refresh_token}")
                    else:
                        print("💡 建议手动更新环境变量中的refresh_token为新值")
                        if not privacy_mode:
                            print(f"💡 新值: {new_refresh_token}")
                
                return access_token, None
            else:
                return None, f"响应中缺少access_token"
                
        except requests.exceptions.Timeout:
            return None, "请求超时，网络连接可能有问题"
        except requests.exceptions.ConnectionError:
            return None, "网络连接错误，无法连接到阿里云服务器"
        except Exception as e:
            return None, f"Token更新异常: {str(e)}"

    def get_user_info(self, access_token):
        """获取用户信息"""
        try:
            print("👤 正在获取用户信息...")
            url = "https://user.aliyundrive.com/v2/user/get"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(url=url, headers=headers, json={}, timeout=15)
            if response.status_code == 200:
                result = response.json()
                user_name = result.get("user_name", "未知用户")
                nick_name = result.get("nick_name", user_name)
                phone = result.get("phone", "")
                
                # 手机号脱敏处理
                display_phone = mask_sensitive_data(phone, "phone") if phone else ""
                
                print(f"👤 用户: {nick_name}")
                if display_phone:
                    print(f"📱 手机: {display_phone}")
                    
                return nick_name, display_phone
            else:
                print(f"⚠️ 获取用户信息失败，状态码: {response.status_code}")
                return "未知用户", ""
                
        except Exception as e:
            print(f"❌ 获取用户信息异常: {e}")
            return "未知用户", ""

    def get_storage_info(self, access_token):
        """获取存储空间信息"""
        try:
            print("💾 正在获取存储空间信息...")
            url = "https://api.aliyundrive.com/v2/user/get"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(url=url, headers=headers, json={}, timeout=15)
            if response.status_code == 200:
                result = response.json()
                personal_space = result.get("personal_space_info", {})
                used_size = personal_space.get("used_size", 0)
                total_size = personal_space.get("total_size", 0)
                
                # 转换为GB
                used_gb = round(used_size / (1024**3), 2) if used_size > 0 else 0
                total_gb = round(total_size / (1024**3), 2) if total_size > 0 else 0
                
                if total_gb > 0:
                    usage_percent = round((used_gb / total_gb) * 100, 1)
                    print(f"💾 存储空间: {used_gb}GB / {total_gb}GB ({usage_percent}%)")
                return used_gb, total_gb
            else:
                print(f"⚠️ 获取存储信息失败，状态码: {response.status_code}")
                return 0, 0
                
        except Exception as e:
            print(f"❌ 获取存储信息异常: {e}")
            return 0, 0

    def sign(self, access_token):
        """执行签到"""
        try:
            print("📝 正在执行签到...")
            url = "https://member.aliyundrive.com/v1/activity/sign_in_list"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(url=url, headers=headers, json={}, timeout=15)
            print(f"🔍 签到响应状态码: {response.status_code}")
            
            if response.status_code != 200:
                try:
                    error_detail = response.json()
                    error_msg = error_detail.get("message", f"HTTP {response.status_code}")
                except:
                    error_msg = f"签到请求失败，HTTP状态码: {response.status_code}"
                return error_msg, False
                
            result = response.json()
            
            # 检查是否签到成功
            if not result.get("success", False):
                error_msg = result.get("message", "签到失败")
                print(f"❌ 签到失败: {error_msg}")
                return error_msg, False
            
            sign_days = result.get("result", {}).get("signInCount", 0)
            print(f"📅 累计签到: {sign_days}天")
            
            # 分析签到日志，找到今天的签到记录
            sign_logs = result.get("result", {}).get("signInLogs", [])
            reward_info = ""
            today_reward_found = False
            
            if sign_logs:
                print("🔍 正在分析签到日志...")
                # 找到第一个status为normal的记录（今天签到的）
                for i, log in enumerate(sign_logs):
                    if log.get("status") == "normal":
                        print(f"📋 找到今日签到记录: 第{log.get('day', i+1)}天")
                        today_reward_found = True
                        
                        reward_type = log.get("type", "")
                        reward_amount = log.get("rewardAmount", 0)
                        reward_obj = log.get("reward", {})
                        
                        print(f"🔍 奖励类型: {reward_type}, 数量: {reward_amount}")
                        
                        if reward_type == "postpone":
                            if reward_amount > 0:
                                reward_info = f"延期卡 x{reward_amount}"
                                print(f"🎁 今日奖励: 延期卡 x{reward_amount}")
                            else:
                                reward_info = f"延期卡"
                                print(f"🎁 今日奖励: 延期卡")
                        elif reward_type == "backupSpaceMb":
                            if reward_amount > 0:
                                reward_info = f"备份空间 {reward_amount}MB"
                                print(f"🎁 今日奖励: 备份空间 {reward_amount}MB")
                            else:
                                reward_info = f"备份空间"
                                print(f"🎁 今日奖励: 备份空间")
                        elif reward_obj.get("name") or reward_obj.get("description"):
                            reward_name = reward_obj.get("name", "")
                            reward_desc = reward_obj.get("description", "")
                            reward_info = f"{reward_name}{reward_desc}"
                            print(f"🎁 今日奖励: {reward_name}{reward_desc}")
                        elif reward_amount > 0:
                            reward_info = f"{reward_type} x{reward_amount}"
                            print(f"🎁 今日奖励: {reward_type} x{reward_amount}")
                        else:
                            reward_info = f"{reward_type}"
                            print(f"🎁 今日奖励: {reward_type}")
                        break
            
            # 如果仍然没有奖励信息
            if not reward_info:
                if sign_days == 1:
                    reward_info = "首次签到完成"
                    print("📅 首次签到完成")
                else:
                    reward_info = "签到完成"
                    print("📅 签到完成")
            
            success_msg = f"签到成功，累计{sign_days}天"
            print("✅ 签到成功")
            return success_msg, True, reward_info
            
        except Exception as e:
            error_msg = f"签到异常: {str(e)}"
            print(f"❌ {error_msg}")
            return error_msg, False, ""

    def main(self):
        """主执行函数"""
        print(f"\n==== 账号{self.index} 开始签到 ====")
        
        # 1. 更新Token
        access_token, error_msg = self.update_token()
        if not access_token:
            full_error_msg = f"""Token更新失败

❌ 错误原因: {error_msg}

🔧 解决方法:
1. 打开阿里云盘网页版: https://www.aliyundrive.com/
2. 登录您的账号
3. 按F12打开开发者工具
4. 切换到Application标签页
5. 在左侧找到Local Storage → https://www.aliyundrive.com
6. 找到token项，复制refresh_token的值
7. 更新环境变量ALIYUN_REFRESH_TOKEN

💡 提示: refresh_token通常以字母开头，长度较长"""
            
            print(f"❌ {full_error_msg}")
            return full_error_msg, False
        
        # 2. 获取用户信息
        user_name, display_phone = self.get_user_info(access_token)
        
        # 3. 获取存储信息
        used_gb, total_gb = self.get_storage_info(access_token)
        
        # 4. 执行签到
        sign_msg, is_success, reward_info = self.sign(access_token)
        
        # 5. 组合结果消息（通知用）
        final_msg = f"""🌟 阿里云盘签到结果

👤 账号: {user_name}"""
        
        if display_phone:
            final_msg += f"\n📱 手机: {display_phone}"
            
        if total_gb > 0:
            usage_percent = round((used_gb / total_gb) * 100, 1)
            final_msg += f"\n💾 存储: {used_gb}GB / {total_gb}GB ({usage_percent}%)"
            
        final_msg += f"""
📝 签到: {sign_msg}"""

        if reward_info:
            final_msg += f"\n🎁 奖励: {reward_info}"

        # Token更新状态
        if self.new_refresh_token:
            if auto_update_token:
                final_msg += f"\n🔄 Token: 已自动更新"
            else:
                final_msg += f"\n🔄 Token: 检测到新token，请手动更新"
            
            # 只在明确允许时显示token
            if show_token_in_notification:
                final_msg += f"\n💡 新token: {mask_sensitive_data(self.new_refresh_token, 'token')}"

        final_msg += f"\n⏰ 时间: {datetime.now().strftime('%m-%d %H:%M')}"
        
        print(f"{'✅ 签到成功' if is_success else '❌ 签到失败'}")
        return final_msg, is_success

def main():
    """主程序入口"""
    print(f"==== 阿里云盘签到开始 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")
    
    # 显示配置状态
    print(f"🤖 自动更新Token: {'已启用' if auto_update_token else '已禁用'}")
    print(f"🔒 隐私保护模式: {'已启用' if privacy_mode else '已禁用'}")
    print(f"🔑 通知显示Token: {'是' if show_token_in_notification else '否'}")
    
    # 随机延迟（整体延迟）
    if random_signin:
        delay_seconds = random.randint(0, max_random_delay)
        if delay_seconds > 0:
            signin_time = datetime.now() + timedelta(seconds=delay_seconds)
            print(f"🎲 随机延迟: {format_time_remaining(delay_seconds)}")
            wait_with_countdown(delay_seconds, "阿里云盘签到")
    
    # 获取refresh_token配置
    aliyun_tokens = os.getenv("ALIYUN_REFRESH_TOKEN", "")
    
    if not aliyun_tokens:
        error_msg = """❌ 未找到ALIYUN_REFRESH_TOKEN环境变量

🔧 获取refresh_token的方法:
1. 打开阿里云盘网页版: https://www.aliyundrive.com/
2. 登录您的账号  
3. 按F12打开开发者工具
4. 切换到Application标签页
5. 在左侧找到Local Storage → https://www.aliyundrive.com
6. 找到token项，复制refresh_token的值
7. 在青龙面板中添加环境变量ALIYUN_REFRESH_TOKEN

💡 提示: refresh_token通常很长，以字母开头"""
        
        print(error_msg)
        notify_user("阿里云盘签到失败", error_msg)
        return

    # 支持多账号（用换行或&分隔）
    if '\n' in aliyun_tokens:
        tokens = [token.strip() for token in aliyun_tokens.split('\n') if token.strip()]
    else:
        tokens = [token.strip() for token in aliyun_tokens.split('&') if token.strip()]
    
    print(f"📝 共发现 {len(tokens)} 个账号")
    
    success_count = 0
    total_count = len(tokens)
    results = []
    
    for index, token in enumerate(tokens):
        try:
            # 账号间随机等待
            if index > 0:
                delay = random.uniform(10, 20)
                print(f"⏱️  随机等待 {delay:.1f} 秒后处理下一个账号...")
                time.sleep(delay)
            
            # 执行签到
            aliyun = AliYun(token, index + 1)
            result_msg, is_success = aliyun.main()
            
            if is_success:
                success_count += 1
            
            results.append({
                'index': index + 1,
                'success': is_success,
                'message': result_msg,
                'account_id': aliyun.account_id
            })
            
            # 发送单个账号通知
            status = "成功" if is_success else "失败"
            title = f"阿里云盘账号{index + 1}签到{status}"
            
            notify_user(title, result_msg)
            
        except Exception as e:
            error_msg = f"账号{index + 1}: 执行异常 - {str(e)}"
            print(f"❌ {error_msg}")
            
            title = f"阿里云盘账号{index + 1}签到失败"
            notify_user(title, error_msg)
    
    # 发送汇总通知
    if total_count > 1:
        summary_msg = f"""📊 阿里云盘签到汇总

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
                summary_msg += f"\n{status_icon} 账号{result['index']}"
        
        notify_user("阿里云盘签到汇总", summary_msg)
    
    print(f"\n==== 阿里云盘签到完成 - 成功{success_count}/{total_count} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ====")

if __name__ == "__main__":
    main()
