import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.endboss as E


def test_endboss_info_handles_null_cleared_levels():
    user = {
        "id": "u1",
        "username": "endboss-user",
        "nickname": "EndBossUser",
        "email": "endboss@example.com",
        "course_level": "beginner",
        "crowns": 10,
        "endboss_cleared_levels": None,
        "max_unlocked_unit": {},
        "seen_questions": {},
    }

    res = E.endboss_info(target_level=None, user=user)

    assert res["cleared_levels"] == []
    assert res["already_cleared"] is False
