"""fill_in_blank 오답 고정 해설 — Claude 품질 업그레이드 배치 (일회성).

generate_fill_feedback.py(결정론·템플릿 기반, Claude 미사용)의 후속 단계.
문항당 1건(정답 1개라 오답 무관 고정)을 Claude(haiku)로 다시 생성해
같은 출력 경로(frontend/src/data/fillFeedback/{level}/unit_{unit}.json)를
덮어쓴다. 실패한 문항은 기존 템플릿 문구를 그대로 보존(폴백).

프롬프트는 Cowork 검증본. 문항당 1콜이라 객관식(선택지당 1콜)보다 훨씬 저렴
(전체 ~1254문항 기준 haiku 어림 $1.5 안팎, 일회성).

실행:
    cd ai-mon/backend
    $env:PYTHONIOENCODING="utf-8"; $env:PYTHONUTF8="1"
    python scripts/generate_fill_feedback_claude.py --dry-run     # 대상 집계만
    python scripts/generate_fill_feedback_claude.py               # 실제 생성
    python scripts/generate_fill_feedback_claude.py --level beginner
"""
import argparse
import asyncio
import json
import os
import glob

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
DATA = os.path.join(BACKEND, "data")
OUT_ROOT = os.path.normpath(
    os.path.join(BACKEND, "..", "frontend", "src", "data", "fillFeedback")
)

CATEGORIES = ("quiz", "miniboss")
LEVELS = ("beginner", "intermediate", "advanced")
MODEL = "claude-haiku-4-5-20251001"

# ── 생성 프롬프트 (Cowork 산출·검증 완료) ───────────────────────────────────
SYSTEM_PROMPT = """너는 파이썬 입문자를 가르치는 한국어 AI 튜터 '에이몬'이다. 주관식 빈칸(fill-in-the-blank) 문제에서 학생이 오답을 입력했을 때 보여줄 고정 해설을 작성한다. 정답이 1개뿐이므로 문항당 해설도 1건이다.
규칙:
- 정확히 2문장, 한국어, 격려하는 톤으로 작성한다.
- 1문장: 이 빈칸에 무엇이 들어가야 하는지, 학생이 흔히 헷갈리는 지점(비슷한 이름, 다른 언어의 유사 키워드, 유사한 자료형/함수 등)을 문제의 실제 맥락과 힌트를 근거로 구체적으로 짚는다. "정답은 X입니다"라고만 쓰는 것은 금지한다.
- 2문장: 관련된 올바른 개념을 한 줄로 정리한다.
- 오직 해설 텍스트만 출력한다. 접두어, 따옴표, 마크다운을 붙이지 않는다."""

# 플레이스홀더: {question} {answer} {hint} {correct_feedback}
USER_TEMPLATE = """[문제]
{question}

[정답]
{answer}

[힌트]
{hint}

[정답 시 보여주는 피드백(참고용, 이 톤과 내용을 참고하되 그대로 복사하지 말 것)]
{correct_feedback}

위 문제에 대한 오답 시 보여줄 2문장 해설만 출력하세요."""
# ────────────────────────────────────────────────────────────────────────────


def load_questions(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, list):
        return d
    if isinstance(d, dict) and isinstance(d.get("questions"), list):
        return d["questions"]
    return []


def collect() -> dict:
    """(level, unit) -> { question_id: q_dict }"""
    buckets: dict = {}
    for cat in CATEGORIES:
        for path in glob.glob(os.path.join(DATA, cat, "*", "*.json")):
            level = os.path.basename(os.path.dirname(path))
            if level not in LEVELS:
                continue
            for q in load_questions(path):
                if not isinstance(q, dict) or q.get("type") != "fill_in_blank":
                    continue
                qid = q.get("question_id") or q.get("id")
                unit = q.get("unit")
                if not qid or unit is None:
                    continue
                bucket = buckets.setdefault((level, int(unit)), {})
                bucket.setdefault(qid, q)  # 유닛 내 첫 항목만(기존 generate_fill_feedback.py 와 동일 정책)
    return buckets


def fb_correct(q: dict) -> str:
    fb = q.get("feedback")
    return fb.get("correct") if isinstance(fb, dict) else (str(fb) if fb else "")


async def gen_one(client, q: dict) -> str:
    prompt = (USER_TEMPLATE
              .replace("{question}", str(q.get("question", "")))
              .replace("{answer}", str(q.get("answer", "")))
              .replace("{hint}", str(q.get("hint") or "(없음)"))
              .replace("{correct_feedback}", fb_correct(q) or "(없음)"))
    msg = await client.messages.create(
        model=MODEL, max_tokens=384, system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


async def run(dry_run: bool, level_filter: str | None, concurrency: int) -> None:
    buckets = collect()
    if level_filter:
        buckets = {k: v for k, v in buckets.items() if k[0] == level_filter}
    total = sum(len(m) for m in buckets.values())
    print(f"대상 fill_in_blank 문항 {total}개, {len(buckets)} (level,unit) 파일"
          + (f" [level={level_filter}]" if level_filter else ""))
    if dry_run:
        print("(--dry-run: 생성 생략)")
        return

    import anthropic
    client = anthropic.AsyncAnthropic()
    sem = asyncio.Semaphore(concurrency)

    async def one(qid, q):
        async with sem:
            try:
                return qid, await gen_one(client, q)
            except Exception as e:
                print(f"  skip {qid} ({e})")
                return qid, None

    for (level, unit), mapping in sorted(buckets.items()):
        out_path = os.path.join(OUT_ROOT, level, f"unit_{unit}.json")
        existing = {}
        if os.path.exists(out_path):
            with open(out_path, "r", encoding="utf-8") as f:
                existing = json.load(f)

        tasks = [one(qid, q) for qid, q in mapping.items()]
        results = await asyncio.gather(*tasks)
        upgraded = 0
        for qid, text in results:
            if text:
                existing[qid] = text
                upgraded += 1
            # 실패 시 기존(템플릿) 값 보존 — 이미 existing 에 있으면 그대로 둠

        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(dict(sorted(existing.items())), f, ensure_ascii=False, indent=2)
        print(f"  wrote {level}/unit_{unit}.json ({upgraded}/{len(mapping)} upgraded)", flush=True)


if __name__ == "__main__":
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(BACKEND, "..", ".env"))
    except ImportError:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--level", choices=LEVELS, default=None)
    ap.add_argument("--concurrency", type=int, default=6)
    args = ap.parse_args()
    asyncio.run(run(args.dry_run, args.level, args.concurrency))
