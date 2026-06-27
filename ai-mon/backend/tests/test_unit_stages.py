"""유닛 스테이지 정합성 + 왕관 판정 회귀 테스트 (C-3).

배경: 유닛 완료/왕관 판정은 lessons 메타의 `stages` 로 required 스테이지 집합
  {unit-1 .. unit-stages} ∪ {unit-boss} 을 만든다(progress.py). 메타 stages 가
  실제로 유저가 푸는 quiz 콘텐츠(data/quiz/<level>/unit_N.json)의 스테이지 수와
  어긋나면:
    - stages 과다(예: 과거 beginner unit2=7, 실제 quiz 6) → required 에 없는
      스테이지(2-7)를 요구 → 왕관 영구 미지급
    - stages 과소 → 마지막 스테이지를 끝내기 전에 왕관 조기 지급

  ※ 진실 기준은 'data/quiz'(유저가 실제로 푸는 문제)다. 브리핑 슬라이드
    (data/lessons/)는 별개 파일이라 여기서 기준으로 쓰지 않는다.

1) 정합성: 전 레벨×유닛에서 meta.stages == 실제 quiz non-boss 스테이지 수.
2) 왕관 회귀: 7스테이지 유닛은 X-7 까지, 6스테이지 유닛은 X-6 까지 + 보스라야 왕관 1개.
"""
import sys
import os
import json

import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import utils as U
from routers import progress as P

DATA_DIR = os.path.join(backend_path, "data")
META_FILE = {
    "beginner": os.path.join(DATA_DIR, "lessons.json"),
    "intermediate": os.path.join(DATA_DIR, "lessons_intermediate.json"),
    "advanced": os.path.join(DATA_DIR, "lessons_advanced.json"),
}
LEVELS = ["beginner", "intermediate", "advanced"]


def _content_nonboss_count(level: str, unit: int) -> int | None:
    """유저가 실제로 푸는 quiz 콘텐츠의 distinct non-boss 스테이지 수(진실 기준).

    quiz 파일은 한 스테이지에 문제가 여러 개이므로 stage 값으로 distinct 집계한다.
    boss 문제(is_boss=True 또는 stage 에 'boss')는 제외한다.
    """
    cf = os.path.join(DATA_DIR, "quiz", level, f"unit_{unit}.json")
    if not os.path.exists(cf):
        return None
    data = json.load(open(cf, encoding="utf-8"))
    questions = data.get("questions", data) if isinstance(data, dict) else data
    stages = {
        q.get("stage")
        for q in questions
        if not q.get("is_boss") and "boss" not in str(q.get("stage", "")).lower()
    }
    return len(stages)


def _meta_stages(level: str, unit: int) -> int | None:
    f = META_FILE[level]
    if not os.path.exists(f):
        return None
    for u in json.load(open(f, encoding="utf-8")):
        if u.get("unit_id") == unit:
            return u.get("stages")
    return None


# ─────────────────────── 1. 메타 ↔ 콘텐츠 정합성 ───────────────────────

@pytest.mark.parametrize("level", LEVELS)
@pytest.mark.parametrize("unit", range(1, 9))
def test_meta_stages_matches_content(level, unit):
    """meta.stages 가 실제 콘텐츠 스테이지 수와 일치해야 한다.
    콘텐츠 추가/변경 시 메타를 안 맞추면 이 테스트가 즉시 잡는다."""
    content = _content_nonboss_count(level, unit)
    if content is None:
        pytest.skip(f"{level} unit{unit}: 콘텐츠 파일 없음")
    meta = _meta_stages(level, unit)
    assert meta == content, (
        f"{level} unit{unit}: meta.stages={meta} != 실제 콘텐츠 {content}. "
        f"왕관 판정 깨짐(과다=영구 미지급, 과소=조기 지급)."
    )


# ─────────────────────── 2. 왕관 판정 회귀 ───────────────────────

@pytest.fixture
def progress_env(monkeypatch, tmp_path):
    """USERS_FILE / PROGRESS_FILE 를 임시 파일로 리디렉트 + 유저 1명 준비."""
    users_file = tmp_path / "users.json"
    users_file.write_text(
        json.dumps([{
            "id": "u1", "xp": 0, "crowns": 0, "lv": 1,
            "character": "slime", "titles": [], "awarded_crown_units": [],
            "course_level": "beginner",
        }]),
        encoding="utf-8",
    )
    progress_file = tmp_path / "progress.json"
    progress_file.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "PROGRESS_FILE", str(progress_file))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    return {"users": str(users_file)}


def _submit(unit: int, stage: str) -> int:
    """스테이지 완료 제출 → 그 호출에서 지급된 왕관 수 반환.

    진입 게이트(assert_stage_access)는 왕관 지급 로직과 직교하므로, 호출 유저는
    레벨테스트 완료 + 전 유닛 해금 상태로 둔다. 각 테스트가 1..N 순서대로 제출하므로
    이전 스테이지 완료 조건도 자연히 충족된다."""
    req = P.ProgressUpdateRequest(unit=unit, stage=stage, score=100, is_completed=True)
    user = {
        "id": "u1", "course_level": "beginner",
        "is_level_tested": True, "max_unlocked_unit": {"beginner": 99},
    }
    res = P.update_progress(req, user)
    return res["crowns_awarded"]


def _crowns(users_file: str) -> int:
    with open(users_file, encoding="utf-8") as f:
        return json.load(f)[0].get("crowns", 0)


def test_seven_stage_unit_no_early_crown(progress_env):
    """7스테이지 유닛(beginner unit4=for/while, quiz 7스테이지): X-7 을 빼고
    X-1..X-6 + 보스만 완료하면 왕관이 나오면 안 된다(meta.stages 과소 회귀).
    X-7 완료 시 지급."""
    unit = 4
    granted = 0
    # 2-1 ~ 2-6 + 보스 (2-7 누락)
    for i in range(1, 7):
        granted += _submit(unit, f"{unit}-{i}")
    granted += _submit(unit, f"{unit}-boss")
    assert granted == 0, "X-7 미완료인데 왕관 조기 지급됨(meta.stages 과소 회귀)"
    assert _crowns(progress_env["users"]) == 0

    # 마지막 2-7 완료 → 이제서야 왕관 1개
    granted += _submit(unit, f"{unit}-7")
    assert granted == 1, "전 스테이지+보스 완료인데 왕관 미지급"
    assert _crowns(progress_env["users"]) == 1


def test_six_stage_unit_crown_at_six(progress_env):
    """6스테이지 유닛(beginner unit3): X-1..X-6 + 보스 완료면 왕관 1개.
    X-5 까지 + 보스(=X-6 누락)면 아직 미지급."""
    unit = 3
    granted = 0
    # 3-1 ~ 3-5 + 보스 (3-6 누락)
    for i in range(1, 6):
        granted += _submit(unit, f"{unit}-{i}")
    granted += _submit(unit, f"{unit}-boss")
    assert granted == 0, "X-6 미완료인데 왕관 지급됨"
    assert _crowns(progress_env["users"]) == 0

    # 3-6 완료 → 왕관 1개
    granted += _submit(unit, f"{unit}-6")
    assert granted == 1, "6스테이지 유닛 전 완료인데 왕관 미지급"
    assert _crowns(progress_env["users"]) == 1


def test_unit2_six_stage_crown_fixed(progress_env):
    """회귀 고정: beginner unit2 는 quiz 가 6스테이지(2-1..2-6)인데 과거 meta=7 이라
    required 에 존재하지 않는 2-7 이 끼어 왕관이 영구 미지급됐다.
    meta 를 6 으로 고친 뒤에는 2-1..2-6 + 보스 완료 시 왕관 1개가 정상 지급돼야 한다."""
    unit = 2
    granted = 0
    for i in range(1, 6):  # 2-1 ~ 2-5
        granted += _submit(unit, f"{unit}-{i}")
    granted += _submit(unit, f"{unit}-boss")
    assert granted == 0, "2-6 미완료인데 왕관 지급됨"

    granted += _submit(unit, f"{unit}-6")  # 마지막 스테이지
    assert granted == 1, "unit2 6스테이지+보스 완료인데 왕관 미지급(meta=7 회귀)"
    assert _crowns(progress_env["users"]) == 1


def test_crown_not_double_granted(progress_env):
    """완료 후 같은 스테이지 재제출해도 왕관 중복 지급 없음(awarded_crown_units 가드)."""
    unit = 3
    for i in range(1, 7):
        _submit(unit, f"{unit}-{i}")
    _submit(unit, f"{unit}-boss")
    assert _crowns(progress_env["users"]) == 1
    # 보스 재제출 → 이미 awarded
    extra = _submit(unit, f"{unit}-boss")
    assert extra == 0
    assert _crowns(progress_env["users"]) == 1
