#!/usr/bin/env python3
"""
포맷/이스케이프/정답중복 탐지기
사용법:
  python detect_format_issues.py <폴더 또는 파일 경로> [...]
예:
  python detect_format_issues.py ./lessons ./quizzes ./minibosses
출력: 의심 항목을 파일/위치/사유와 함께 표로 출력. (고치진 않음, 발견만)
"""
import json, glob, os, re, sys

# 정답 필드로 쓰일 법한 키 이름들 (퀴즈/미니보스 스키마에 맞게 수정하세요)
ANSWER_KEYS = {"answer", "answers", "correct", "correct_answer", "solution", "correct_index", "correct_options"}
# 보기/선택지 필드 후보
OPTION_KEYS = {"options", "choices", "candidates", "selections"}

# JSON 트리를 재귀적으로 순회하며 (경로, 문자열) 쌍만 모두 방출한다.
# 문자열 값에 대해서만 포맷/이스케이프 검사를 수행하기 때문이다.
def walk(o, path=""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk(v, f"{path}[{i}]")
    elif isinstance(o, str):
        yield path, o

def scan_strings(data, fname, issues):
    for path, s in walk(data):
        # 코드/출력/터미널 필드는 리터럴 \n·스마트따옴표가 의도된 값일 수 있어 별도 취급한다.
        in_code = ".code" in path or ".output" in path or "terminal" in path
        # 1) 마크다운 코드펜스 (```), 거의 항상 버그
        if "```" in s:
            issues.append((fname, path, "마크다운펜스(```)", repr(s[:70])))
        # 2) 백틱 (인라인 코드 마크다운 흔적)
        elif "`" in s:
            issues.append((fname, path, "백틱(`)", repr(s[:70])))
        # 3) 리터럴 \n  — code/output에선 의도일 수 있음, 일반 텍스트면 의심
        if "\\n" in s and not in_code:
            issues.append((fname, path, "텍스트에 리터럴\\n(렌더깨짐 의심)", repr(s[:70])))
        # 4) 이중 이스케이프 (\\\\n 등) — 거의 항상 버그
        if "\\\\" in s:
            issues.append((fname, path, "이중이스케이프(\\\\)", repr(s[:70])))
        # 5) HTML 엔티티 깨짐 흔적
        if any(e in s for e in ("&lt;", "&gt;", "&amp;", "&quot;")):
            issues.append((fname, path, "HTML엔티티", repr(s[:70])))
        # 6) 스마트따옴표(’ “ ”) — 코드 필드면 실행 에러
        if in_code and any(c in s for c in ("’", "‘", "“", "”")):
            issues.append((fname, path, "코드에 스마트따옴표", repr(s[:70])))

def scan_answers(data, fname, issues):
    """정답 중복/복수 정답 탐지. 퀴즈 객체를 재귀적으로 찾음."""
    def visit(o, path=""):
        if isinstance(o, dict):
            # 정답 필드가 리스트로 2개 이상이면 '정답 복수' 의심
            for k in o:
                if k in ANSWER_KEYS and isinstance(o[k], list) and len(o[k]) > 1:
                    issues.append((fname, f"{path}.{k}", "정답이 복수(2개+)", repr(o[k])[:70]))
            # options 안에 동일 보기 중복
            for k in o:
                if k in OPTION_KEYS and isinstance(o[k], list):
                    opts = [str(x).strip() for x in o[k]]
                    dup = {x for x in opts if opts.count(x) > 1}
                    if dup:
                        issues.append((fname, f"{path}.{k}", "보기 중복", repr(list(dup))[:70]))
            # 정답 텍스트가 보기 중 2개 이상과 일치하면 채점 모호
            ans = next((o[k] for k in o if k in ANSWER_KEYS), None)
            opts = next((o[k] for k in o if k in OPTION_KEYS and isinstance(o[k], list)), None)
            if ans is not None and opts:
                matches = [x for x in opts if str(x).strip() == str(ans).strip()]
                if len(matches) > 1:
                    issues.append((fname, path, "정답이 보기 여러개와 일치", repr(ans)[:50]))
            for k, v in o.items():
                visit(v, f"{path}.{k}")
        elif isinstance(o, list):
            for i, v in enumerate(o):
                visit(v, f"{path}[{i}]")
    visit(data)

def gather(paths):
    files = []
    for p in paths:
        if os.path.isdir(p):
            files += glob.glob(os.path.join(p, "**", "*.json"), recursive=True)
        else:
            files.append(p)
    return sorted(set(files))

def main():
    paths = sys.argv[1:] or ["."]
    issues, broken = [], []
    for f in gather(paths):
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            broken.append((f, str(e)))
            continue
        scan_strings(data, f, issues)
        scan_answers(data, f, issues)

    if broken:
        print("=== JSON 파싱 실패 (먼저 복구) ===")
        for f, e in broken:
            print(f"  {os.path.basename(f)}: {e}")
        print()
    print(f"=== 의심 항목 {len(issues)}건 ===")
    for f, path, kind, sample in issues:
        print(f"  [{kind}] {os.path.basename(f)} {path}\n      {sample}")
    if not issues:
        print("  (없음)")

if __name__ == "__main__":
    main()
