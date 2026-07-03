"""code_input 문항 "정답 출력" 자동 생성 (레버5 Wave1, 무저작·결정론).

배경: code_input 채점(/code/submit, endboss 등)은 정답이든 오답이든 항상 Claude로
채점한다. 정답 예시코드(answer)를 실제로 실행해 stdout 이 결정론적으로 재현되는
문항이면, 그 출력을 "expected_output" 필드로 문항 JSON에 채워 넣는다. (이 스크립트는
데이터만 채운다 — 채점 로직 연결은 별도 승인 후 단계.)

대상: quiz / miniboss / unitboss / endboss 카테고리의 type == "code_input".
제외(비결정 출력 의심): input()/random/time/datetime/네트워크/파일IO 관련 호출이
코드에 있으면 스킵 — Wave2(수동 테스트케이스 저작) 대상으로 남긴다.

안전장치: 정답 코드를 2회 독립 실행해 stdout 이 완전히 일치할 때만 "expected_output"
을 채운다(1회 우연한 재현 방지). 실행은 격리된 subprocess + 타임아웃.

실행:
    cd ai-mon/backend
    $env:PYTHONIOENCODING="utf-8"; $env:PYTHONUTF8="1"
    python scripts/generate_code_expected_output.py --dry-run   # 집계만
    python scripts/generate_code_expected_output.py             # 실제 적용(in-place)
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
DATA = os.path.join(BACKEND, "data")

# 코드에 이 패턴이 있으면 비결정/부작용 위험으로 보고 자동 적용 대상에서 제외한다.
NONDETERMINISTIC_PATTERNS = [
    r"\binput\s*\(",
    r"\brandom\b",
    r"\btime\.",
    r"\bdatetime\b",
    r"\bsocket\b",
    r"\brequests\b",
    r"\burllib\b",
    r"\bopen\s*\(",
    r"\bos\.(system|popen|remove|listdir)\b",
    r"\bset\s*\(",     # set 반복 순서 비보장
    r"\{[^{}]*\bfor\b[^{}]*\}",  # set/dict comprehension (순서 이슈 가능성)
    r"\buuid\b",
]
NONDET_RE = re.compile("|".join(NONDETERMINISTIC_PATTERNS))

TIMEOUT_SEC = 5

CODE_BLOCK_RE = re.compile(r"```(?:python)?\n(.*?)```", re.DOTALL)
BLANK_LINE_RE = re.compile(r"^([ \t]*)_{3,}[ \t]*$", re.MULTILINE)


def build_program(question: dict) -> str | None:
    """answer 가 전체 프로그램이면 그대로, 문제의 코드블록 안 빈칸(_______)을
    채우는 조각이면 빈칸을 answer 로 치환한 전체 프로그램을 반환한다.
    실행 대상을 구성할 수 없으면 None."""
    answer = str(question.get("answer", ""))
    qtext = question.get("question", "") or ""
    m = CODE_BLOCK_RE.search(qtext)
    if not m:
        return answer  # 코드블록 없음 → answer 자체가 전체 프로그램이라고 가정

    code_block = m.group(1)
    blank = BLANK_LINE_RE.search(code_block)
    if not blank:
        return answer  # 빈칸 없는 코드블록 → answer 가 전체 프로그램

    indent = blank.group(1)
    indented_answer = "\n".join(
        (indent + line if line.strip() else line)
        for line in answer.splitlines()
    ) or (indent + answer)
    return BLANK_LINE_RE.sub(indented_answer, code_block, count=1)


def load_questions(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, list):
        return d
    if isinstance(d, dict) and isinstance(d.get("questions"), list):
        return d["questions"]
    return []


def iter_code_input_files():
    for cat in ("quiz", "miniboss", "unitboss"):
        for path in glob.glob(os.path.join(DATA, cat, "*", "*.json")):
            yield path
    for path in glob.glob(os.path.join(DATA, "endboss", "*.json")):
        yield path


def run_code(code: str) -> tuple[bool, str]:
    """(성공여부, stdout). 실패/타임아웃/비정상 종료 시 성공=False."""
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True, text=True, timeout=TIMEOUT_SEC,
            encoding="utf-8", errors="replace",
        )
    except subprocess.TimeoutExpired:
        return False, ""
    if proc.returncode != 0:
        return False, ""
    return True, proc.stdout


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    total = 0
    applied = 0
    skip_nondet = 0
    skip_exec_fail = 0
    skip_mismatch = 0
    skip_no_answer = 0
    skip_empty_output = 0

    for path in iter_code_input_files():
        questions = load_questions(path)
        changed = False
        for q in questions:
            if not isinstance(q, dict) or q.get("type") != "code_input":
                continue
            total += 1
            answer = q.get("answer")
            if not answer or not str(answer).strip():
                skip_no_answer += 1
                continue
            program = build_program(q)
            if not program or not program.strip():
                skip_no_answer += 1
                continue
            if NONDET_RE.search(program):
                skip_nondet += 1
                continue

            ok1, out1 = run_code(program)
            if not ok1:
                skip_exec_fail += 1
                continue
            ok2, out2 = run_code(program)  # self-test: 재실행 일치 확인
            if not ok2 or out1 != out2:
                skip_mismatch += 1
                continue
            if not out1.strip():
                # 빈 출력은 오답도 동일하게 "빈 문자열"이 될 수 있어 채점 근거로 위험함
                # (예: Streamlit 등 UI 코드라 `python -c` 로는 stdout 이 안 남는 경우).
                skip_empty_output += 1
                if q.get("expected_output") == "":
                    q.pop("expected_output", None)  # 이전 실행의 잘못된 빈 값 정리
                    changed = True
                continue

            if not args.dry_run:
                q["expected_output"] = out1
                changed = True
            applied += 1

        if changed and not args.dry_run:
            full_data = load_full(path, questions)  # write 모드로 열기 전에 원본 구조 확보
            with open(path, "w", encoding="utf-8") as f:
                json.dump(full_data, f, ensure_ascii=False, indent=2)

    print(f"code_input 총 {total}개")
    print(f"  자동 적용(expected_output 채움): {applied}")
    print(f"  스킵 - 비결정 패턴 감지: {skip_nondet}")
    print(f"  스킵 - 실행 실패/타임아웃: {skip_exec_fail}")
    print(f"  스킵 - 재실행 불일치: {skip_mismatch}")
    print(f"  스킵 - 빈 출력(채점 근거 부적합): {skip_empty_output}")
    print(f"  스킵 - answer 없음: {skip_no_answer}")
    if args.dry_run:
        print("(--dry-run: 파일 미변경)")


def load_full(path: str, mutated_questions: list):
    """원본 파일이 list 또는 {"questions": [...]} 래핑인지 보존해 반환."""
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, list):
        return mutated_questions
    if isinstance(d, dict) and isinstance(d.get("questions"), list):
        d["questions"] = mutated_questions
        return d
    return d


if __name__ == "__main__":
    main()
