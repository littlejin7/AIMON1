import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.code as CODE
import routers.quiz as QUIZ


def test_find_question_uses_course_level_and_unit_for_miniboss(monkeypatch):
    target = {
        "question_id": "miniboss_adv_ci_1_1_005",
        "type": "code_input",
        "unit": 1,
        "question": "advanced miniboss code",
        "answer": "print('ok')",
    }

    def fake_load(category, course_level=None, unit=None, **kwargs):
        if category == "miniboss" and course_level == "advanced" and unit == 1:
            return [target]
        return []

    monkeypatch.setattr(QUIZ, "load_questions_by_category", fake_load)
    CODE._QUESTION_INDEX = {}

    found = CODE.find_question(
        "miniboss_adv_ci_1_1_005",
        course_level="advanced",
        unit=1,
        stage="1-1",
    )

    assert found == target
