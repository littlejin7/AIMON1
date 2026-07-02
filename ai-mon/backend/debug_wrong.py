"""
오답복습 "오답 없음" 진단 스크립트 - 수정 없음, 읽기 전용.
실행: cd backend && python debug_wrong.py
"""
import os, sys
from pathlib import Path

# .env 로드 (backend 한 단계 위 ai-mon/.env)
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)
    print(f"[env] {env_path} 로드 완료")
else:
    print(f"[env] {env_path} 없음 - 환경변수 직접 설정 필요")

sys.path.insert(0, str(Path(__file__).parent))

import routers.utils as U
from routers.quiz import load_questions_by_category
from collections import Counter

SEP = "=" * 72
TARGET_EMAIL = "littlejin7@gmail.com"

# == 유저 조회 ======================================================
print(f"\n{SEP}")
print("[ 대상 유저 조회 ]")
user_id = None

if U.USE_SUPABASE:
    # 1) email로 시도
    res = U.supabase.table("users").select("id,email,username").eq("email", TARGET_EMAIL).execute()
    if res.data:
        row = res.data[0]
        user_id = row["id"]
        print(f"  email    : {row.get('email')}")
        print(f"  username : {row.get('username', '(없음)')}")
        print(f"  user_id  : {user_id}")
    else:
        # 2) username으로 시도
        res2 = U.supabase.table("users").select("id,email,username").eq("username", "tester_jinny").execute()
        if res2.data:
            row = res2.data[0]
            user_id = row["id"]
            print(f"  username : {row.get('username')}")
            print(f"  email    : {row.get('email', '(없음)')}")
            print(f"  user_id  : {user_id}")
        else:
            # 3) users 테이블 전체 목록 (최대 10명)
            all_users = U.supabase.table("users").select("id,email,username").limit(10).execute()
            print(f"  users 테이블 내 유저 ({len(all_users.data)}명 조회):")
            for row in all_users.data:
                print(f"    id={row.get('id')}  email={row.get('email')}  username={row.get('username')}")
            # 4) attempts 최근 5건에서 user_id 추론
            print("  attempts 최근 5건:")
            all_att = U.supabase.table("attempts").select("user_id,answered_at") \
                        .order("answered_at", desc=True).limit(5).execute()
            for row in all_att.data:
                print(f"    user_id={row.get('user_id')}  at={row.get('answered_at')}")
            if all_att.data:
                user_id = all_att.data[0]["user_id"]
                print(f"  --> 임시 사용: {user_id}")
else:
    print("  USE_SUPABASE=false - JSON 모드")
    users = U.load_users()
    u = next((u for u in users if u.get("email") == TARGET_EMAIL), None)
    if u:
        user_id = u["id"]
        print(f"  user_id: {user_id}")
    else:
        print(f"  {TARGET_EMAIL} 미발견, 종료")
        sys.exit(1)

if not user_id:
    print("[오류] user_id 확정 불가 → 종료")
    sys.exit(1)

# == 출력 1: attempts 전체 (시간순) ==================================
print(f"\n{SEP}")
print("▶ 출력 1: attempts 전체 (시간순)")
attempts = U.get_attempts_by_user(user_id)
attempts_sorted = sorted(attempts, key=lambda a: str(a.get("answered_at") or ""))

if not attempts_sorted:
    print("  → attempts 없음.")
else:
    COLS = ["question_id", "mode", "is_correct", "unit", "level", "answered_at"]
    col_w = [24, 12, 10, 6, 14, 28]
    hdr = "  ".join(c.ljust(w) for c, w in zip(COLS, col_w))
    print(hdr)
    print("-" * (sum(col_w) + 2 * (len(COLS) - 1)))
    for a in attempts_sorted:
        row = "  ".join(str(a.get(c, "")).ljust(w) for c, w in zip(COLS, col_w))
        print(row)
    print(f"\n총 {len(attempts_sorted)}건")

# == 출력 2: 분포 =====================================================
print(f"\n{SEP}")
print("▶ 출력 2: 분포")
mode_cnt  = Counter(a.get("mode")  for a in attempts)
level_cnt = Counter(a.get("level") for a in attempts)
unit_cnt  = Counter(a.get("unit")  for a in attempts)
wrong_cnt = sum(1 for a in attempts if not a.get("is_correct"))

print(f"  is_correct=false : {wrong_cnt}건  /  전체 {len(attempts)}건")
print(f"  mode 분포  : {dict(mode_cnt)}")
print(f"  level 분포 : {dict(level_cnt)}")
print(f"  unit 분포  : {dict(sorted((k, v) for k, v in unit_cnt.items()))}")

lesson_wrong   = [a for a in attempts if a.get("mode") in U.LESSON_MODES and not a.get("is_correct")]
lesson_correct = [a for a in attempts if a.get("mode") in U.LESSON_MODES and a.get("is_correct")]
review_correct = [a for a in attempts if a.get("mode") in U.REVIEW_MODES and a.get("is_correct")]
print(f"\n  LESSON_MODES {U.LESSON_MODES} 오답 : {len(lesson_wrong)}건")
print(f"  LESSON_MODES                 정답 : {len(lesson_correct)}건")
print(f"  REVIEW_MODES {U.REVIEW_MODES} 정답 : {len(review_correct)}건")

# == 출력 3: get_wrong_answers =========================================
print(f"\n{SEP}")
print("▶ 출력 3: get_wrong_answers 결과")
wrong_all = U.get_wrong_answers(user_id, course_level="beginner", unit=None)
print(f"  unit=None : {len(wrong_all)}개  →  {wrong_all}")
for u in range(1, 9):
    wu = U.get_wrong_answers(user_id, course_level="beginner", unit=u)
    mark = f"{len(wu)}개 → {wu}" if wu else "0개"
    print(f"  unit={u}    : {mark}")

# 내부 집합을 course_level 필터 없이도 확인
print("\n-- 내부 집합 (course_level 필터 없음) --")
wrong_ids_nf: set = set()
cleared_ids_nf: set = set()
for a in attempts:
    qid = a.get("question_id")
    if not qid:
        continue
    mode = a.get("mode")
    if mode in U.LESSON_MODES and not a.get("is_correct"):
        wrong_ids_nf.add(qid)
    elif mode in U.REVIEW_MODES and a.get("is_correct"):
        cleared_ids_nf.add(qid)
print(f"  wrong_ids(필터 없음)   : {len(wrong_ids_nf)}개 → {sorted(wrong_ids_nf)[:20]}")
print(f"  cleared_ids(필터 없음) : {len(cleared_ids_nf)}개 → {sorted(cleared_ids_nf)[:20]}")
print(f"  차집합                 : {len(wrong_ids_nf - cleared_ids_nf)}개 → {sorted(wrong_ids_nf - cleared_ids_nf)[:20]}")

print("\n-- 내부 집합 (course_level='beginner' 필터) --")
wrong_ids: set = set()
cleared_ids: set = set()
for a in attempts:
    if a.get("level") != "beginner":
        continue
    qid = a.get("question_id")
    if not qid:
        continue
    mode = a.get("mode")
    if mode in U.LESSON_MODES and not a.get("is_correct"):
        wrong_ids.add(qid)
    elif mode in U.REVIEW_MODES and a.get("is_correct"):
        cleared_ids.add(qid)
print(f"  wrong_ids   : {len(wrong_ids)}개 → {sorted(wrong_ids)[:20]}")
print(f"  cleared_ids : {len(cleared_ids)}개 → {sorted(cleared_ids)[:20]}")
print(f"  차집합      : {len(wrong_ids - cleared_ids)}개 → {sorted(wrong_ids - cleared_ids)[:20]}")

# == 출력 4: review_index 매칭 =========================================
print(f"\n{SEP}")
print("▶ 출력 4: wrong_ids × quiz+miniboss 인덱스 매칭")
review_pool = (
    load_questions_by_category("quiz",     course_level="beginner")
    + load_questions_by_category("miniboss", course_level="beginner")
)
review_index = {}
for q in review_pool:
    qid = q.get("question_id")
    if qid and qid not in review_index:
        review_index[qid] = q

print(f"  review_index 크기: {len(review_index)}")
print(f"  quiz 샘플    : {sorted(k for k in review_index if k.startswith('q'))[:5]}")
print(f"  miniboss 샘플: {sorted(k for k in review_index if k.startswith('mb'))[:3]}")

final_wrong = wrong_ids - cleared_ids   # course_level 필터 적용 집합 사용

if not final_wrong:
    print("\n  final_wrong 가 비어 있음 → 매칭 검사 불필요.")
    print("\n  ※ 진단 포인트:")
    print(f"    - wrong_ids({len(wrong_ids)}) 가 0이면: LESSON_MODES 오답 attempt 자체가 없음")
    print(f"      → attempts에 mode=quiz/miniboss, is_correct=false 기록이 있는지 출력1 확인")
    if wrong_ids_nf:
        print(f"    - 필터 없이는 {len(wrong_ids_nf)}개 → level 필드가 'beginner'가 아님!")
        lv_dist = Counter(a.get("level") for a in attempts
                          if a.get("mode") in U.LESSON_MODES and not a.get("is_correct"))
        print(f"      오답 attempt의 level 분포: {dict(lv_dist)}")
else:
    matched, unmatched = [], []
    for qid in sorted(final_wrong):
        if qid in review_index:
            q = review_index[qid]
            matched.append((qid, q.get("unit"), q.get("quiz_category")))
        else:
            unmatched.append(qid)

    print(f"\n  매칭됨 ({len(matched)}개):")
    for qid, unit, cat in matched:
        print(f"    {qid:<22}  unit={unit}  cat={cat}")

    print(f"\n  매칭 안 됨 ({len(unmatched)}개):")
    for qid in unmatched:
        print(f"    {qid}  ← quiz/miniboss 풀에 없음")
        for lvl in ("intermediate", "advanced"):
            alt = {q.get("question_id")
                   for q in load_questions_by_category("quiz", course_level=lvl)
                              + load_questions_by_category("miniboss", course_level=lvl)}
            if qid in alt:
                print(f"      → {lvl} 풀에는 존재 (level 불일치?)")
        train_ids = {q.get("question_id")
                     for q in load_questions_by_category("train", course_level="beginner")}
        if qid in train_ids:
            print(f"      → train(beginner) 풀에 존재 (train id가 attempt에 기록됨?)")

print(f"\n{SEP}")
print("진단 완료.")
