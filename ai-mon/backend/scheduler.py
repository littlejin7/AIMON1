from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
import pytz
from routers.utils import load_users
from services.email_service import send_email

scheduler = BackgroundScheduler(timezone=pytz.timezone('Asia/Seoul'))

def send_streak_reminders():
    print(f"[{datetime.now()}] Running streak reminder job...")
    users = load_users()
    
    # Calculate yesterday in KST (UTC+9)
    kst_now = datetime.utcnow() + timedelta(hours=9)
    yesterday_str = (kst_now - timedelta(days=1)).strftime("%Y-%m-%d")
    
    reminded_count = 0
    for user in users:
        # User logged in yesterday but not yet today
        if user.get("last_login") == yesterday_str:
            email = user.get("email")
            # Skip if no email or empty string (often true for some social logins)
            if not email or not email.strip():
                continue
                
            nickname = user.get("nickname", user.get("username", "유저"))
            subject = f"[AI MON] {nickname}님, 스트릭을 이어나갈 시간입니다! 🔥"
            html_content = f"""
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>AI MON 스트릭 리마인더</h2>
                <p>안녕하세요 <strong>{nickname}</strong>님!</p>
                <p>어제 열심히 학습하셨군요! 오늘 접속하지 않으면 힘들게 쌓은 스트릭이 초기화됩니다.</p>
                <p>지금 바로 로그인해서 오늘의 학습을 진행하고 스트릭 보상을 받아보세요!</p>
                <br>
                <a href="https://aimon.com" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    AI MON 접속하기
                </a>
            </div>
            """
            
            success = send_email(to_email=email, subject=subject, html_content=html_content)
            if success:
                reminded_count += 1
                
    print(f"[{datetime.now()}] Streak reminder job finished. Reminders sent: {reminded_count}")

# Schedule the job every day at 18:00 KST
scheduler.add_job(
    send_streak_reminders,
    trigger=CronTrigger(hour=18, minute=0, timezone=pytz.timezone('Asia/Seoul')),
    id="streak_reminder_job",
    replace_existing=True
)
