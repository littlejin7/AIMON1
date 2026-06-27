"""버그2(보스 HP) 회귀 테스트 — MY_HP_DELTA=ceil(1000/3)=334, 3오답=HP0 검증."""
import os, sys

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import boss as B


def test_my_hp_delta_is_one_third_ceil():
    assert B.MY_HP_DELTA == -(-B.MY_HP_INIT // 3)
    assert B.MY_HP_DELTA * 3 >= B.MY_HP_INIT  # 3오답이면 0 이하 보장


def test_hp_drains_two_thirds_one_third_zero():
    hp = B.MY_HP_INIT
    drained = []
    for _ in range(3):
        hp = max(0, hp - B.MY_HP_DELTA)
        drained.append(hp)
    assert drained[0] == 666   # 2/3
    assert drained[1] == 332   # 1/3
    assert drained[2] == 0     # 0
    assert hp >= 0             # 음수 클램프
