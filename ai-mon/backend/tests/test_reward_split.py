"""2단계 B/C/D파트 회귀 테스트: 보상 coin/ranking 분리 + GP 게이트 + GP 기반
레벨업 + 주간/누적 리더보드.

검증 정책:
- 3차 진화 전 클리어 → coin↑, gp 0(gate), ranking_score↑, lv 동결(신규 레벨업 없음).
- 3차 진화 후 클리어 → coin↑, gp↑, ranking_score↑, gp 누적으로 lv 상승.
- 상점/일반 흐름에서 XP 로는 진화·레벨업이 발생하지 않는다(A·B 회귀).
- 주간 게임 리더보드(/game/ranking)는 ranking_score(weekly_ranking) 기준 정렬 — coin/gp 아님.
- 누적 리더보드(/game/ranking/overall, 2-D)는 top-level 누적 ranking_score 기준 정렬,
  상점 소비(coin_balance)에 영향받지 않는다.
"""
import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.utils as U
from routers import game as G


# ── grant_reward: 3차 전 (coin↑, gp 0, ranking↑, lv 동결) ─────────────────────

def test_grant_reward_before_stage3_no_gp_no_levelup():
    user = {"id": "u1", "xp": 0, "lv": 5, "character": "slime"}  # stage 0
    r = U.grant_reward(user, coin_delta=300, ranking_score_delta=300, gp_delta=300,
                       event_type="game_clear")

    assert r["coin_delta"] == 300
    assert r["ranking_score_delta"] == 300
    assert r["gp_delta"] == 0                     # gp_gate: 3차 전엔 0
    assert user["coin_balance"] == 300
    assert user["total_coin_earned"] == 300
    assert user["ranking_score"] == 300
    assert (user.get("gp") or 0) == 0
    assert user["lv"] == 5                        # 동결(신규 레벨업 없음)
    assert r["level_up"] is False


# ── grant_reward: 3차 후 (coin↑, gp↑, ranking↑, gp 로 lv 상승) ────────────────

def test_grant_reward_after_stage3_gp_and_gp_levelup():
    # 3차 진화 유저(evolution_stage=3), 진화 시점 lv=30.
    user = {"id": "u2", "xp": 0, "lv": 30, "character": "final_ghost", "evolution_stage": 3, "gp": 0}

    # GP_PER_LEVEL(1000) 미만 누적 → 아직 레벨업 없음(기준선 유지)
    r1 = U.grant_reward(user, coin_delta=300, ranking_score_delta=300, gp_delta=300,
                        event_type="game_clear")
    assert r1["gp_delta"] == 300                  # gate 통과
    assert user["gp"] == 300
    assert user["coin_balance"] == 300
    assert user["ranking_score"] == 300
    assert user["gp_level_base"] == 30            # 진화 시점 lv 캡처
    assert user["lv"] == 30                        # 300<1000 → 아직 유지
    assert r1["level_up"] is False

    # 누적 gp 가 GP_PER_LEVEL 을 넘기면 lv 상승(base + gp//1000)
    r2 = U.grant_reward(user, gp_delta=800, event_type="game_clear")  # gp 총 1100
    assert user["gp"] == 1100
    assert user["lv"] == 31                        # 30 + 1100//1000
    assert r2["level_up"] is True


def test_gp_level_curve_and_no_decrease():
    assert U.calc_level_from_gp(0) == 0
    assert U.calc_level_from_gp(999) == 0
    assert U.calc_level_from_gp(1000) == 1
    assert U.calc_level_from_gp(2500) == 2

    # 3차 전이면 recompute 는 lv 를 건드리지 않는다(동결)
    pre = {"lv": 7, "character": "robot"}  # stage 1
    U.recompute_level_from_gp(pre)
    assert pre["lv"] == 7
    assert "gp_level_base" not in pre

    # 3차 후 gp 를 줄여도 lv 는 감소하지 않는다(max 유지)
    post = {"lv": 40, "evolution_stage": 3, "gp": 5000}
    U.recompute_level_from_gp(post)
    base = post["gp_level_base"]
    assert post["lv"] == max(40, base + 5)
    post["gp"] = 0
    U.recompute_level_from_gp(post)
    assert post["lv"] == max(40, base + 5)         # 감소 없음


# ── weekly_ranking_score 파생 (serialize_user) ───────────────────────────────

def test_serialize_user_derives_weekly_ranking_score():
    wk = U.iso_week()
    user = {
        "id": "u3", "character": "slime",
        "game_rewards": {"weekly_ranking": {wk: {"runner": 200, "aizzak": 150}}},
    }
    s = U.serialize_user(user)
    assert s["weekly_ranking_score"] == 350        # 현재 주 합계 파생


# ── 리더보드: ranking_score(weekly_ranking) 기준 정렬 ───────────────────────

def test_leaderboard_sorts_by_ranking_score(monkeypatch):
    wk = U.iso_week()
    users = [
        {"id": "a", "username": "a", "nickname": "Alpha", "character": "slime",
         "game_rewards": {"weekly_ranking": {wk: {"runner": 100}}}},
        {"id": "b", "username": "b", "nickname": "Beta", "character": "slime",
         "game_rewards": {"weekly_ranking": {wk: {"runner": 500}}}},
    ]
    monkeypatch.setattr(G, "load_users", lambda: users)
    G._ranking_cache.clear()

    result = G.game_ranking(3, {"id": "a", "character": "slime"})
    # ranking_score 큰 Beta 가 1위 (coin/gp 아님)
    assert result["top"][0]["nickname"] == "Beta"
    assert result["top"][0]["score"] == 500
    assert result["top"][1]["nickname"] == "Alpha"
    G._ranking_cache.clear()


# ── 미션 클리어(2-C): coin + ranking_score 분리, gp 0 ────────────────────────

def test_mission_claim_grants_coin_and_ranking_no_gp(monkeypatch, tmp_path):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    from routers import mission as MI
    from routers.missions_core import find_def, _load_defs, DAILY_DEFS
    if not DAILY_DEFS:
        _load_defs()

    defn = find_def("d_quiz3")           # goal 3, reward xp 300
    goal = defn["goal"]
    amt = defn.get("reward", {}).get("xp", 0)
    assert amt > 0                        # coin 보상이 있어야 검증 의미가 있다

    user = {
        "id": "u-mission", "xp": 0, "lv": 1, "character": "slime", "crowns": 0,
        "missions": {
            "daily": {"date": U.today_kst(), "progress": {"d_quiz3": goal}, "claimed": []},
            "weekly": {"week": U.iso_week(), "progress": {}, "claimed": [], "login_days": []},
        },
    }
    U.save_users([user])

    resp = MI.claim_mission(MI.ClaimRequest(mission_id="d_quiz3"), {"id": "u-mission"})

    assert resp["already_claimed"] is False
    # §7: 미션 보상은 coin + ranking_score 분리 발급, gp 0
    assert resp["reward"]["coin_delta"] == amt
    assert resp["reward"]["ranking_score_delta"] == amt
    assert resp["reward"]["gp_delta"] == 0
    assert resp["user_state"]["coin_balance"] == amt
    assert resp["user_state"]["ranking_score"] == amt
    assert resp["user_state"]["gp"] == 0

    persisted = U.get_user_by_id("u-mission")
    assert persisted["coin_balance"] == amt
    assert persisted["ranking_score"] == amt
    assert (persisted.get("gp") or 0) == 0    # 3차 전 gp 미발생
    assert persisted["xp"] == 0               # xp 신규 지급 없음(레거시 값 보존)


# ── 2-D: 누적 ranking_score 리더보드(/game/ranking/overall) ──────────────────

def test_ranking_overall_sorts_by_cumulative_ranking_score(monkeypatch):
    """게임+미션+보스로 쌓인 top-level 누적 ranking_score 기준 정렬. coin/gp 무관."""
    users = [
        {"id": "a", "username": "a", "nickname": "Alpha", "character": "slime",
         "ranking_score": 800, "coin_balance": 100, "gp": 500},
        {"id": "b", "username": "b", "nickname": "Beta", "character": "robot",
         "ranking_score": 15300, "coin_balance": 0, "gp": 0},   # 엔드보스 클리어 상당
        {"id": "c", "username": "c", "nickname": "Gamma", "character": "slime",
         "ranking_score": 0},   # 아직 미적립 → 목록 제외
    ]
    monkeypatch.setattr(G, "load_users", lambda: users)
    G._ranking_cache.clear()

    result = G.game_ranking_overall(3, {"id": "a", "character": "slime"})

    assert [e["nickname"] for e in result["top"]] == ["Beta", "Alpha"]
    assert result["top"][0]["score"] == 15300
    assert result["top"][1]["score"] == 800
    assert result["me"] == {"rank": 2, "character": "slime", "score": 800}
    G._ranking_cache.clear()


def test_ranking_overall_unranked_user_gets_dash(monkeypatch):
    """누적 ranking_score 가 0인 유저는 entries 에서 제외되고 me.rank='-' 로 표시된다
    (주간 리더보드 _me_row 폴백과 동일 관례)."""
    users = [
        {"id": "a", "username": "a", "nickname": "Alpha", "character": "slime", "ranking_score": 500},
        {"id": "zero", "username": "zero", "nickname": "Zero", "character": "slime", "ranking_score": 0},
    ]
    monkeypatch.setattr(G, "load_users", lambda: users)
    G._ranking_cache.clear()

    result = G.game_ranking_overall(3, {"id": "zero", "character": "slime"})
    assert [e["nickname"] for e in result["top"]] == ["Alpha"]   # 0점 유저는 목록 제외
    assert result["me"] == {"rank": "-", "character": "slime", "score": 0}
    G._ranking_cache.clear()


def test_ranking_overall_unaffected_by_shop_purchase(monkeypatch, tmp_path):
    """상점에서 코인을 소비해도 누적 ranking_score·리더보드 순위는 불변."""
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    from routers import user as UR

    user = {
        "id": "u-shop", "username": "shopper", "nickname": "Shopper", "character": "slime",
        "coin_balance": 1000, "ranking_score": 15300, "gp": 0, "evolution_stage": 0,
        "crowns": 5, "xp": 0, "purchased_themes": ["dark"],
    }
    U.save_users([user])

    resp = UR.purchase_theme(UR.PurchaseThemeRequest(theme_id="ocean"), user=user)  # cost 500
    assert resp["success"] is True
    assert resp["coin_remaining"] == 500

    persisted = U.get_user_by_id("u-shop")
    assert persisted["coin_balance"] == 500          # 코인만 차감
    assert persisted["ranking_score"] == 15300       # 누적 랭킹 점수 불변

    monkeypatch.setattr(G, "load_users", lambda: [persisted])
    G._ranking_cache.clear()
    result = G.game_ranking_overall(3, {"id": "u-shop", "character": "slime"})
    assert result["top"][0]["score"] == 15300        # 순위에도 영향 없음
    G._ranking_cache.clear()
