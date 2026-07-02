from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
import pytz
import os
import json
import shutil
import logging
from routers.utils import (
    USE_SUPABASE,
    supabase,
    load_users,
    load_progress,
    load_wrong_answers,
    now_kst,
    purge_soft_deleted_users,
)
from services.email_service import send_email

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone=pytz.timezone('Asia/Seoul'))
SOFT_DELETE_RETENTION_DAYS = 30

def send_streak_reminders():
    logger.info("Running streak reminder job...")

    # Calculate yesterday in KST (UTC+9)
    kst_now = now_kst()
    yesterday_str = (kst_now - timedelta(days=1)).strftime("%Y-%m-%d")

    if USE_SUPABASE:
        try:
            # Query only required fields and filter directly in Supabase
            res = supabase.table("users").select("email, nickname, username, last_login").eq("last_login", yesterday_str).execute()
            target_users = res.data or []
        except Exception:
            logger.exception("send_streak_reminders: Supabase 유저 쿼리 실패")
            target_users = []
    else:
        users = load_users()
        target_users = [u for u in users if u.get("last_login") == yesterday_str]

    reminded_count = 0
    for user in target_users:
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

    logger.info("Streak reminder job finished. Reminders sent: %d", reminded_count)


def backup_to_json():
    logger.info("Running database backup job...")
    try:
        kst_now = now_kst()
        today_str = kst_now.strftime("%Y-%m-%d")

        # Identify DATA_DIR from utils
        from routers.utils import DATA_DIR
        backup_dir = os.path.join(DATA_DIR, "backup", today_str)
        os.makedirs(backup_dir, exist_ok=True)

        # 1. Fetch data
        if USE_SUPABASE:
            users_data = supabase.table("users").select("*").execute().data
            progress_data = supabase.table("progress").select("*").execute().data
            wrong_answers_data = supabase.table("wrong_answers").select("*").execute().data
        else:
            users_data = load_users()
            progress_data = load_progress()
            wrong_answers_data = load_wrong_answers()

        # 2. Write JSON files
        for filename, data in [
            ("users.json", users_data),
            ("progress.json", progress_data),
            ("wrong_answers.json", wrong_answers_data)
        ]:
            file_path = os.path.join(backup_dir, filename)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info("Backup files successfully created at: %s", backup_dir)

        # 3. Retention policy: delete backups older than 7 days
        base_backup_dir = os.path.join(DATA_DIR, "backup")
        if os.path.exists(base_backup_dir):
            retention_limit = kst_now - timedelta(days=7)
            for folder_name in os.listdir(base_backup_dir):
                folder_path = os.path.join(base_backup_dir, folder_name)
                if os.path.isdir(folder_path):
                    try:
                        folder_date = datetime.strptime(folder_name, "%Y-%m-%d")
                        if folder_date.date() < retention_limit.date():
                            shutil.rmtree(folder_path)
                            logger.info("Removed expired backup directory: %s", folder_name)
                    except ValueError:
                        pass  # YYYY-MM-DD 형식이 아닌 폴더 — 보존 정책 대상 아님

    except Exception:
        logger.exception("Database backup job failed")


def purge_deleted_accounts():
    logger.info(
        "Running soft-deleted account purge job... retention_days=%d",
        SOFT_DELETE_RETENTION_DAYS,
    )
    try:
        result = purge_soft_deleted_users(retention_days=SOFT_DELETE_RETENTION_DAYS)
        logger.info(
            "Soft-deleted account purge job finished. deleted_count=%d cutoff=%s",
            result["deleted_count"],
            result["cutoff"],
        )
    except Exception:
        logger.exception("Soft-deleted account purge job failed")


# Schedule the job every day at 18:00 KST
scheduler.add_job(
    send_streak_reminders,
    trigger=CronTrigger(hour=18, minute=0, timezone=pytz.timezone('Asia/Seoul')),
    id="streak_reminder_job",
    replace_existing=True
)

# Schedule the backup job every day at 03:00 KST
scheduler.add_job(
    backup_to_json,
    trigger=CronTrigger(hour=3, minute=0, timezone=pytz.timezone('Asia/Seoul')),
    id="daily_backup_job",
    replace_existing=True
)

# Schedule the soft-delete purge job every day at 04:00 KST
scheduler.add_job(
    purge_deleted_accounts,
    trigger=CronTrigger(hour=4, minute=0, timezone=pytz.timezone('Asia/Seoul')),
    id="soft_delete_purge_job",
    replace_existing=True
)
