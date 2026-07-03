"""fill_in_blank 오답 고정 해설 정적 번들 생성 (Claude 호출 0).

배경: fill_in_blank 문항은 `feedback.correct`(개념 설명)·`hint`·`answer` 만 있고
`feedback.wrong` 이 없어서, 현재 오답 시 `/quiz/ai-feedback/stream`(Claude)로 매번
해설을 생성한다. fill 은 정답이 1개라 "문항당 고정 해설 1건"으로 충분하므로,
기존 author 작성 필드(answer + 개념설명 + hint)만으로 결정론적으로 고정 해설을
만들어 프론트 정적 번들로 내보낸다. 런타임 Claude 호출을 없애는 것이 목적.

- 대상: quiz / miniboss 카테고리의 type == "fill_in_blank" (QuizCard 가 서빙하는 경로).
- 출력: frontend/src/data/fillFeedback/{level}/unit_{unit}.json  = { question_id: 해설 }
- 재실행 안전(idempotent). 프롬프트/정책 바뀌면 다시 돌려 덮어쓴다.

실행:
    cd ai-mon/backend && python scripts/generate_fill_feedback.py
"""
import json
import os
import glob
import collections

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
DATA = os.path.join(BACKEND, "data")
OUT_ROOT = os.path.normpath(
    os.path.join(BACKEND, "..", "frontend", "src", "data", "fillFeedback")
)

CATEGORIES = ("quiz", "miniboss")
LEVELS = ("beginner", "intermediate", "advanced")

# feedback.correct 앞에 붙는 칭찬 절을 제거해 개념 설명만 남긴다.
def concept_from_correct(fb_correct: str) -> str:
    if not fb_correct:
        return ""
    s = str(fb_correct).strip()
    if "!" in s:
        head, _, tail = s.partition("!")
        # head 가 짧은 칭찬 절이고 tail 이 실질 내용이면 tail 만 사용
        if len(head) <= 20 and len(tail.strip()) >= 8:
            return tail.strip()
    return s


def build_feedback(q: dict) -> str:
    answer = str(q.get("answer", "")).strip()
    fb = q.get("feedback")
    fb_correct = fb.get("correct") if isinstance(fb, dict) else None
    concept = (
        (q.get("explanation") or "").strip()
        or concept_from_correct(fb_correct)
        or (q.get("hint") or "").strip()
    )
    text = f'아쉽지만 정답은 "{answer}"입니다.'
    if concept:
        text += " " + concept
    return text


def load_questions(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, list):
        return d
    if isinstance(d, dict):
        qs = d.get("questions")
        if isinstance(qs, list):
            return qs
    return []


def main() -> None:
    # (level, unit) -> { question_id: feedback }
    buckets: dict = collections.defaultdict(dict)
    collisions = 0
    total = 0

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
                bucket = buckets[(level, int(unit))]
                if qid in bucket:
                    collisions += 1
                    continue  # 같은 (level,unit) 내 id 중복 → 첫 항목 유지
                bucket[qid] = build_feedback(q)
                total += 1

    written = 0
    for (level, unit), mapping in sorted(buckets.items()):
        out_dir = os.path.join(OUT_ROOT, level)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"unit_{unit}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(dict(sorted(mapping.items())), f, ensure_ascii=False, indent=2)
        written += 1

    print(f"fill_in_blank feedback bundle: {total} entries, {written} files")
    if collisions:
        print(f"  (skipped {collisions} duplicate ids within a unit)")
    print(f"  output: {OUT_ROOT}")


if __name__ == "__main__":
    main()
