import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

from routers.battle_session import grade_objective


def test_grade_objective_accepts_labeled_choice_when_answer_is_text():
    assert grade_objective("A. p", "p") is True
    assert grade_objective("A. P", "p") is True


def test_grade_objective_accepts_text_when_answer_is_labeled_choice():
    assert grade_objective("p", "A. p") is True


def test_grade_objective_rejects_wrong_labeled_choice_text():
    assert grade_objective("B. y", "p") is False

