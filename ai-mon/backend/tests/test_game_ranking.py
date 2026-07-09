import os
import sys

import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

# 랭킹 로직은 game.py 에서 routers.game_ranking 으로 분리됐다. 패치 대상(load_users /
# RANKING_WEIGHT)과 호출 함수가 같은 모듈에서 해석되도록 G 를 game_ranking 으로 잡는다.
from routers import game_ranking as G
from routers import game_common as GC  # _record_weekly_ranking 은 game_common 소유


def _user(user_id, nickname, current=None, previous=None, character="slime", deleted=False):
    weekly_ranking = {}
    if current is not None:
        weekly_ranking[G.iso_week()] = current
    if previous is not None:
        weekly_ranking[G.prev_iso_week()] = previous

    user = {
        "id": user_id,
        "username": user_id,
        "nickname": nickname,
        "character": character,
        "game_rewards": {"weekly_ranking": weekly_ranking},
    }
    if deleted:
        user["deleted_at"] = "2026-01-01T00:00:00Z"
    return user


@pytest.fixture(autouse=True)
def reset_ranking_state(monkeypatch):
    G._ranking_cache.clear()
    monkeypatch.setattr(
        G,
        "RANKING_WEIGHT",
        {
            "runner": 1.0,
            "aizzak": 1.0,
            "aicross": 1.0,
            "aibomb": 1.0,
        },
    )
    yield
    G._ranking_cache.clear()


def test_default_weight_keeps_raw_ranking_score(monkeypatch):
    users = [
        _user("u1", "Alpha", current={"runner": 500, "aibomb": 100}),
        _user("u2", "Beta", current={"aizzak": 300}),
        _user("u3", "Deleted", current={"runner": 9999}, deleted=True),
    ]
    monkeypatch.setattr(G, "load_users", lambda: users)

    result = G.game_ranking(3, {"id": "u1", "character": "slime"})

    assert set(result.keys()) == {"top", "me"}
    assert result["top"][0] == {
        "rank": 1,
        "nickname": "Alpha",
        "character": "slime",
        "score": 600,
    }
    assert result["me"] == {"rank": 1, "character": "slime", "score": 600}


def test_record_weekly_ranking_stores_raw_and_ranking_helper_does_not_mutate(monkeypatch):
    monkeypatch.setattr(
        G,
        "RANKING_WEIGHT",
        {
            "runner": 0.1,
            "aizzak": 1.0,
            "aicross": 1.0,
            "aibomb": 1.0,
        },
    )
    rewards = {}

    GC._record_weekly_ranking(rewards, "runner", 500)

    user = {"game_rewards": rewards}
    raw_before = G._weekly_score_map(user, G.iso_week())
    weighted = G._ranking_weekly_score_map(user, G.iso_week())
    raw_after = G._weekly_score_map(user, G.iso_week())

    assert raw_before == {"runner": 500}
    assert weighted == {"runner": 50}
    assert raw_after == raw_before
    assert rewards["weekly_ranking"][G.iso_week()]["runner"] == 500


def test_game_ranking_by_game_shape_is_preserved(monkeypatch):
    users = [
        _user("u1", "Alpha", current={"runner": 500, "aibomb": 100}, previous={"runner": 500}),
        _user("u2", "Beta", current={"aizzak": 300}, previous={"aizzak": 300}),
    ]
    monkeypatch.setattr(G, "load_users", lambda: users)

    result = G.game_ranking_by_game(3, {"id": "u1", "character": "slime"})

    assert set(result.keys()) == {"games", "last_week_winner"}
    assert len(result["games"]) == len(G.RANKED_GAMES)
    for game in result["games"]:
        assert set(game.keys()) == {"game_id", "title", "top", "me"}
        assert isinstance(game["top"], list)
        assert game["me"] is None or set(game["me"].keys()) == {"rank", "character", "score"}
    if result["games"][0]["top"]:
        assert set(result["games"][0]["top"][0].keys()) == {
            "rank",
            "nickname",
            "character",
            "score",
        }


def test_cached_ranking_reuses_builder_for_same_key():
    calls = {"count": 0}

    def build():
        calls["count"] += 1
        return {"top": [], "me": None}

    first = G._cached_ranking("ranking:test", build)
    second = G._cached_ranking("ranking:test", build)

    assert first == {"top": [], "me": None}
    assert second == first
    assert calls["count"] == 1


def test_ranking_cache_is_split_by_user_id(monkeypatch):
    calls = {"count": 0}
    users = [
        _user("u1", "Alpha", current={"runner": 100}),
        _user("u2", "Beta", current={"runner": 200}),
    ]

    def load_users():
        calls["count"] += 1
        return users

    monkeypatch.setattr(G, "load_users", load_users)

    first = G.game_ranking(3, {"id": "u1", "character": "slime"})
    second = G.game_ranking(3, {"id": "u1", "character": "slime"})
    third = G.game_ranking(3, {"id": "u2", "character": "cat"})

    assert calls["count"] == 2
    assert second == first
    assert first["me"] == {"rank": 2, "character": "slime", "score": 100}
    assert third["me"] == {"rank": 1, "character": "slime", "score": 200}


def test_last_week_winner_uses_ranking_weight(monkeypatch):
    monkeypatch.setattr(
        G,
        "RANKING_WEIGHT",
        {
            "runner": 0.1,
            "aizzak": 1.0,
            "aicross": 1.0,
            "aibomb": 10.0,
        },
    )
    users = [
        _user("u1", "Alpha", previous={"runner": 500}),
        _user("u2", "Beta", previous={"aibomb": 100}),
    ]

    winner = G._compute_last_week_winner(users, G.prev_iso_week())

    assert winner["nickname"] == "Beta"
    assert winner["score"] == 1000
