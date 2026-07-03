"""객관식 오답 "선택지별" 고정 해설 정적 번들 생성 (일회성 배치).

대상: quiz / miniboss 카테고리의 객관식 계열(multiple_choice / output_select / error_find).
각 문항의 "오답 선택지"마다 고정 해설 1건을 Claude(haiku)로 생성해 프론트 정적 번들로
내보낸다. 사전 생성이므로 런타임 Claude 호출은 0 이 된다.

출력: frontend/src/data/choiceFeedback/{level}/unit_{unit}.json
      = { question_id: { "A": "해설", "C": "해설", ... } }   # 정답 선택지 제외

⚠️ SYSTEM_PROMPT / USER_TEMPLATE 는 Cowork 산출물로 채운다(현재 자리표시자).
   채우기 전에는 --dry-run 으로 대상 집계만 확인할 것.

실행:
    cd ai-mon/backend
    $env:PYTHONIOENCODING="utf-8"
    python scripts/generate_choice_feedback.py --dry-run        # 대상/선택지 수 집계만
    python scripts/generate_choice_feedback.py                  # 실제 생성(ANTHROPIC_API_KEY 필요)
"""
import argparse
import asyncio
import json
import os
import glob
import re

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
DATA = os.path.join(BACKEND, "data")
OUT_ROOT = os.path.normpath(
    os.path.join(BACKEND, "..", "frontend", "src", "data", "choiceFeedback")
)

CATEGORIES = ("quiz", "miniboss")
LEVELS = ("beginner", "intermediate", "advanced")
CHOICE_TYPES = ("multiple_choice", "output_select", "error_find")
MODEL = "claude-haiku-4-5-20251001"

# ── 생성 프롬프트 (Cowork 산출·검증 완료) ───────────────────────────────────
SYSTEM_PROMPT = """너는 파이썬 입문자를 가르치는 한국어 AI 튜터 '에이몬'이다. 객관식 문제에서 학생이 특정 오답을 골랐을 때 즉시 보여줄 고정 해설을 작성한다.
규칙:
- 정확히 2문장, 한국어, 격려하는 톤으로 작성한다.
- 1문장: 학생이 이 오답을 고르게 된 오해를 짚는다. 해당 보기의 출력/내용이 왜 틀렸는지 문제의 실제 코드와 값을 근거로 구체적으로 설명한다. "정답은 X입니다" 같은 단순 서술은 금지한다.
- 2문장: 관련된 올바른 개념을 한 줄로 정리한다.
- 오직 해설 텍스트만 출력한다. 다른 설명, 접두어, 따옴표, 마크다운을 붙이지 않는다."""

# 플레이스홀더: {question} {choices} {answer} {wrong_choice}
USER_TEMPLATE = """[문제]
{question}

[보기]
{choices}

[정답]
{answer}

[해설을 작성할 오답 선택지]
{wrong_choice}

위 오답 선택지에 대한 2문장 해설만 출력하세요."""
# ────────────────────────────────────────────────────────────────────────────

_LABELS = ["A", "B", "C", "D", "E"]


def choice_letter(opt: str, index: int) -> str:
    m = re.match(r"\s*([A-Ea-e])[.)]", str(opt or ""))
    if m:
        return m.group(1).upper()
    return _LABELS[index] if index < len(_LABELS) else str(index)


def answer_letter(answer: str, choices: list) -> str | None:
    """정답 선택지의 라벨 문자. answer 가 'A' 또는 전체 텍스트 둘 다 대응."""
    a = str(answer or "").strip()
    if re.fullmatch(r"[A-Ea-e]", a):
        return a.upper()
    for i, c in enumerate(choices):
        cn = str(c).replace("\\n", "\n").strip()
        if cn == a or cn.replace("\n", "") == a.replace("\n", ""):
            return choice_letter(c, i)
    # 앞 글자 매칭(answer 가 'A. ...' 형태)
    m = re.match(r"\s*([A-Ea-e])[.)]", a)
    return m.group(1).upper() if m else None


def load_questions(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, list):
        return d
    if isinstance(d, dict) and isinstance(d.get("questions"), list):
        return d["questions"]
    return []


def collect() -> dict:
    """(level, unit) -> [ (question_id, question_dict, [오답 (letter, choice_text)]) ]"""
    buckets: dict = {}
    for cat in CATEGORIES:
        for path in glob.glob(os.path.join(DATA, cat, "*", "*.json")):
            level = os.path.basename(os.path.dirname(path))
            if level not in LEVELS:
                continue
            for q in load_questions(path):
                if not isinstance(q, dict) or q.get("type") not in CHOICE_TYPES:
                    continue
                choices = q.get("choices") or []
                qid = q.get("question_id") or q.get("id")
                unit = q.get("unit")
                if not qid or unit is None or not choices:
                    continue
                correct = answer_letter(q.get("answer"), choices)
                wrongs = []
                for i, c in enumerate(choices):
                    lt = choice_letter(c, i)
                    if lt != correct:
                        wrongs.append((lt, str(c).replace("\\n", "\n")))
                if not wrongs:
                    continue
                buckets.setdefault((level, int(unit)), {})[qid] = (q, wrongs)
    return buckets


async def gen_one(client, q: dict, wrong_choice: str) -> str:
    choices_text = "\n".join(str(c).replace("\\n", "\n") for c in (q.get("choices") or []))
    prompt = (USER_TEMPLATE
              .replace("{question}", str(q.get("question", "")))
              .replace("{choices}", choices_text)
              .replace("{answer}", str(q.get("answer", "")))
              .replace("{wrong_choice}", wrong_choice))
    msg = await client.messages.create(
        model=MODEL, max_tokens=512, system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


async def run(dry_run: bool, level_filter: str | None, concurrency: int) -> None:
    buckets = collect()
    if level_filter:
        buckets = {k: v for k, v in buckets.items() if k[0] == level_filter}
    total_q = sum(len(m) for m in buckets.values())
    total_choices = sum(len(w) for m in buckets.values() for (_, w) in m.values())
    print(f"대상 객관식 문항 {total_q}개 / 오답 선택지 {total_choices}개, "
          f"{len(buckets)} (level,unit) 파일" + (f" [level={level_filter}]" if level_filter else ""))
    if dry_run:
        print("(--dry-run: 생성 생략)")
        return
    if "COWORK" in SYSTEM_PROMPT or "COWORK" in USER_TEMPLATE:
        raise SystemExit("SYSTEM_PROMPT / USER_TEMPLATE 를 채운 뒤 실행하세요.")

    import anthropic
    client = anthropic.AsyncAnthropic()
    sem = asyncio.Semaphore(concurrency)

    async def one(qid, q, letter, choice_text):
        async with sem:
            try:
                return qid, letter, await gen_one(client, q, choice_text)
            except Exception as e:  # 개별 실패는 스킵(런타임 Claude 폴백이 커버)
                print(f"  skip {qid}:{letter} ({e})")
                return qid, letter, None

    for (level, unit), mapping in sorted(buckets.items()):
        tasks = [one(qid, q, lt, ct)
                 for qid, (q, wrongs) in mapping.items()
                 for (lt, ct) in wrongs]
        out: dict = {}
        for qid, letter, text in await asyncio.gather(*tasks):
            if text:
                out.setdefault(qid, {})[letter] = text
        out_dir = os.path.join(OUT_ROOT, level)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, f"unit_{unit}.json"), "w", encoding="utf-8") as f:
            json.dump(dict(sorted(out.items())), f, ensure_ascii=False, indent=2)
        print(f"  wrote {level}/unit_{unit}.json ({len(out)} q)", flush=True)


if __name__ == "__main__":
    from dotenv import load_dotenv
    import os
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", ".env"))

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--level", choices=LEVELS, default=None, help="한 레벨만 생성")
    ap.add_argument("--concurrency", type=int, default=6)
    args = ap.parse_args()
    asyncio.run(run(args.dry_run, args.level, args.concurrency))
