import os
import json
from dotenv import load_dotenv
from supabase import create_client

# 1. Load env variables
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if not os.path.exists(dotenv_path):
    dotenv_path = os.path.join(os.path.dirname(__file__), "../.env")
load_dotenv(dotenv_path)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

print(f"Connecting to Supabase database at: {url}")
supabase = create_client(url, key)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
PROGRESS_FILE = os.path.join(DATA_DIR, "progress.json")
WRONG_ANSWERS_FILE = os.path.join(DATA_DIR, "wrong_answers.json")


def migrate_users():
    print("\n--- 1. Migrating Users ---")
    if not os.path.exists(USERS_FILE):
        print("users.json not found, skipping user migration.")
        return
        
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        users = json.load(f)
        
    print(f"Loaded {len(users)} users from local users.json")
    success_count = 0
    
    for u in users:
        # 데이터 보정 로직 (seen_questions jsonb 통합 및 레거시 제거)
        u.pop("boss_cleared", None)
        u.pop("completed_stages", None)
        seen_questions = u.get("seen_questions", {})
        if seen_questions is None or not isinstance(seen_questions, dict):
            seen_questions = {}
            
        if "boss_seen_questions" in u:
            seen_questions["boss_seen_questions"] = u.pop("boss_seen_questions")
            
        for key in list(u.keys()):
            if key.startswith("unitboss_seen_"):
                seen_questions[key] = u.pop(key)
                
        if "miniboss_seen_questions" in u:
            seen_questions["miniboss"] = u.pop("miniboss_seen_questions")
            
        if "endboss_seen_questions" in u:
            seen_questions["endboss"] = u.pop("endboss_seen_questions")
            
        u["seen_questions"] = seen_questions
        
        # null 허용 및 JSON schema 보장
        if "token_version" not in u or u["token_version"] is None:
            u["token_version"] = 1
        if "endboss_cleared_levels" not in u or u["endboss_cleared_levels"] is None:
            u["endboss_cleared_levels"] = []
        if "miniboss_cleared_stages" not in u or u["miniboss_cleared_stages"] is None:
            u["miniboss_cleared_stages"] = []
        if "unitboss_cleared_units" not in u or u["unitboss_cleared_units"] is None:
            u["unitboss_cleared_units"] = []
        if "game_rewards" not in u or u["game_rewards"] is None:
            u["game_rewards"] = {}
        if "titles" not in u or u["titles"] is None:
            u["titles"] = []
        if "awarded_crown_units" not in u or u["awarded_crown_units"] is None:
            u["awarded_crown_units"] = []
        if "earned_streak_milestones" not in u or u["earned_streak_milestones"] is None:
            u["earned_streak_milestones"] = []
            
        try:
            supabase.table("users").upsert(u).execute()
            success_count += 1
        except Exception as e:
            print(f"Failed to migrate user '{u.get('username')}': {e}")
            
    print(f"Successfully migrated {success_count}/{len(users)} users to Supabase!")


def migrate_progress():
    print("\n--- 2. Migrating Progress ---")
    if not os.path.exists(PROGRESS_FILE):
        print("progress.json not found, skipping progress migration.")
        return
        
    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
        progress_list = json.load(f)
        
    # Get active user IDs to avoid FK violation
    active_user_ids = set()
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, "r", encoding="utf-8") as uf:
            active_user_ids = {u["id"] for u in json.load(uf)}
            
    print(f"Loaded {len(progress_list)} progress records from local progress.json")
    success_count = 0
    skip_count = 0
    
    for p in progress_list:
        # Skip if user does not exist in users database
        if p.get("user_id") not in active_user_ids:
            skip_count += 1
            continue
            
        # 보정 로직 (위험 5): course_level 필드 누락 시 beginner 세팅
        if "course_level" not in p or p["course_level"] is None or p["course_level"] == "":
            p["course_level"] = "beginner"
            
        # id가 유효한 UUID가 아닐 경우 새 UUID 자동 생성
        import uuid
        try:
            uuid.UUID(p.get("id", ""))
        except (ValueError, TypeError):
            p["id"] = str(uuid.uuid4())
            
        try:
            supabase.table("progress").upsert(p).execute()
            success_count += 1
        except Exception as e:
            print(f"Failed to migrate progress ID '{p.get('id')}': {e}")
            
    print(f"Successfully migrated {success_count} progress records (skipped {skip_count} orphan records) to Supabase!")


def migrate_wrong_answers():
    print("\n--- 3. Migrating Wrong Answers ---")
    if not os.path.exists(WRONG_ANSWERS_FILE):
        print("wrong_answers.json not found, skipping wrong answers migration.")
        return
        
    with open(WRONG_ANSWERS_FILE, "r", encoding="utf-8") as f:
        wrong_answers = json.load(f)
        
    # Get active user IDs to avoid FK violation
    active_user_ids = set()
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, "r", encoding="utf-8") as uf:
            active_user_ids = {u["id"] for u in json.load(uf)}
            
    print(f"Loaded {len(wrong_answers)} wrong answer records from local wrong_answers.json")
    success_count = 0
    skip_count = 0
    
    # wrong_answers 테이블 실제 컬럼 (라우터 저장 코드 + schema.sql 기준).
    # 레거시 JSON에 question/correct_answer/course_level 등 미사용 키가 섞여 있어도
    # 제거된 컬럼으로 인한 upsert 실패를 막기 위해 화이트리스트로 투영한다.
    WA_COLUMNS = {
        "id", "user_id", "question_id", "user_answer",
        "feedback", "ai_explanation", "reviewed", "timestamp",
    }

    for wa in wrong_answers:
        if wa.get("user_id") not in active_user_ids:
            skip_count += 1
            continue

        wa_row = {k: v for k, v in wa.items() if k in WA_COLUMNS}

        try:
            supabase.table("wrong_answers").upsert(wa_row).execute()
            success_count += 1
        except Exception as e:
            print(f"Failed to migrate wrong answer ID '{wa.get('id')}': {e}")
            
    print(f"Successfully migrated {success_count} wrong answer records (skipped {skip_count} orphan records) to Supabase!")


if __name__ == "__main__":
    print("=== STARTING DATA MIGRATION TO SUPABASE ===")
    migrate_users()
    migrate_progress()
    migrate_wrong_answers()
    print("\n=== DATA MIGRATION PROCESS COMPLETED ===")
