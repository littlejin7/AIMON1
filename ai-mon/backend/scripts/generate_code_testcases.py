"""code_input 문항 "함수 테스트케이스" 자동 생성 (레버5 Wave2, 구조 한정 자동화).

Wave1(generate_code_expected_output.py)이 못 채운 문항 중, "단일 함수 정의 +
하나의 파라미터를 기준으로 한 if/elif/else 분기(+ 분기 안에 숫자 파라미터를
기준으로 한 단일 중첩 if/raise)" 구조인 것만 AST 로 분석해 분기별 테스트케이스를
**정답 코드 자체를 실행**해서 자동 도출한다. (임의 값 저작 없음 — 분기 리터럴과
정답 구현 실행 결과만 사용)

대상 밖(수동 저작 또는 영구 Claude 채점 필요, 이 스크립트는 손대지 않음):
  - 함수/클래스가 여러 개, 데코레이터 있음(FastAPI 라우트 등), async def,
    클래스 기반, 분기 조건이 단순 리터럴 == 비교가 아님(길이 비교, not, in 등).

출력: 문항 JSON 에 "testcases": [{"call": "...", "expect": ...} |
                                {"call": "...", "raises": "ExceptionType"}]

실행:
    cd ai-mon/backend
    $env:PYTHONIOENCODING="utf-8"; $env:PYTHONUTF8="1"
    python scripts/generate_code_testcases.py --dry-run
    python scripts/generate_code_testcases.py
"""
import argparse
import ast
import glob
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
DATA = os.path.join(BACKEND, "data")

# Wave1 스크립트의 수집/실행 유틸을 재사용(중복 구현 방지)
_spec = importlib.util.spec_from_file_location(
    "gceo", os.path.join(HERE, "generate_code_expected_output.py")
)
gceo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gceo)


def is_empty_output_candidate(q: dict) -> bool:
    program = gceo.build_program(q)
    if not program or gceo.NONDET_RE.search(program):
        return False
    ok, out = gceo.run_code(program)
    return ok and not out.strip()


LITERAL_TYPES = (ast.Constant,)


def _literal_value(node):
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub) and isinstance(node.operand, ast.Constant):
        return -node.operand.value
    return None


def _default_for_annotation(ann) -> object:
    name = ann.id if isinstance(ann, ast.Name) else None
    if name in ("int", "float"):
        return 3
    if name == "bool":
        return True
    return "테스트"


def analyze_function(code: str):
    """단일 top-level 함수(데코레이터 없음)만 지원. 아니면 None."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None
    top_defs = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
    others = [n for n in tree.body if not isinstance(n, (ast.FunctionDef, ast.Import, ast.ImportFrom))]
    if len(top_defs) != 1 or others:
        return None
    fn = top_defs[0]
    if fn.decorator_list or fn.args.vararg or fn.args.kwarg:
        return None
    return fn


def walk_branches(fn: ast.FunctionDef):
    """반환: [(주분기 파라미터, 주분기 리터럴, 중첩가드 파라미터|None, 중첩가드 리터럴|None,
    분기_end_kind, 분기_end_detail)] 또는 지원 불가 시 None.
    분기_end_kind: 'return'(중첩 없음) | 'nested_guard'(중첩 if/raise + 이후 return).
    """
    params = [a.arg for a in fn.args.args]
    body = fn.body
    stmt = body[0] if body else None
    if not isinstance(stmt, ast.If):
        return None
    test = stmt.test
    if not (isinstance(test, ast.Compare) and len(test.ops) == 1 and isinstance(test.ops[0], ast.Eq)):
        return None
    left, right = test.left, test.comparators[0]
    if isinstance(left, ast.Name) and left.id in params:
        main_param, lit_node = left.id, right
    elif isinstance(right, ast.Name) and right.id in params:
        main_param, lit_node = right.id, left
    else:
        return None
    main_lit = _literal_value(lit_node)
    if main_lit is None and not isinstance(lit_node, ast.Constant):
        return None

    branches = []
    node = stmt
    while True:
        cur_test = node.test
        if not (isinstance(cur_test, ast.Compare) and len(cur_test.ops) == 1
                and isinstance(cur_test.ops[0], ast.Eq)):
            return None
        cl, cr = cur_test.left, cur_test.comparators[0]
        if isinstance(cl, ast.Name) and cl.id == main_param:
            lit = _literal_value(cr)
        elif isinstance(cr, ast.Name) and cr.id == main_param:
            lit = _literal_value(cl)
        else:
            return None
        branch = analyze_branch_body(node.body, params, main_param)
        if branch is None:
            return None
        branches.append((main_lit_or(lit), *branch))

        if len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
            node = node.orelse[0]
            continue
        elif node.orelse:
            # else 절 — 리터럴 없음(대응 없는 나머지 케이스)
            else_branch = analyze_branch_body(node.orelse, params, main_param)
            if else_branch is None:
                return None
            branches.append(("__else__", *else_branch))
        break
    return main_param, branches


def main_lit_or(lit):
    return lit


def analyze_branch_body(stmts, params, main_param):
    """분기 본문이 [return] / [raise](무조건) / [nested if/raise, return] 형태인지 확인.
    반환: (nested_param|None, nested_lit|None, kind, detail).
      kind='return' -> detail=return_expr
      kind='raise'  -> detail=exc_name (무조건 예외, 중첩 가드 없음)
      kind='nested_guard' -> detail=(return_expr, exc_name)
    """
    if len(stmts) == 1 and isinstance(stmts[0], ast.Return):
        return (None, None, "return", stmts[0].value)
    if len(stmts) == 1 and isinstance(stmts[0], ast.Raise):
        raise_call = stmts[0].exc
        exc_name = (raise_call.func.id if isinstance(raise_call, ast.Call)
                    and isinstance(raise_call.func, ast.Name) else None)
        if exc_name is None:
            return None
        return (None, None, "raise", exc_name)
    if (len(stmts) == 2 and isinstance(stmts[0], ast.If) and isinstance(stmts[1], ast.Return)):
        guard = stmts[0]
        if guard.orelse:
            return None
        if not (isinstance(guard.body, list) and len(guard.body) == 1
                and isinstance(guard.body[0], ast.Raise)):
            return None
        gt = guard.test
        if not (isinstance(gt, ast.Compare) and len(gt.ops) == 1 and isinstance(gt.ops[0], ast.Eq)):
            return None
        gl, gr = gt.left, gt.comparators[0]
        if isinstance(gl, ast.Name) and gl.id in params:
            nested_param, nested_lit = gl.id, _literal_value(gr)
        elif isinstance(gr, ast.Name) and gr.id in params:
            nested_param, nested_lit = gr.id, _literal_value(gl)
        else:
            return None
        raise_call = guard.body[0].exc
        exc_name = raise_call.func.id if isinstance(raise_call, ast.Call) and isinstance(raise_call.func, ast.Name) else None
        if exc_name is None:
            return None
        return (nested_param, nested_lit, "nested_guard", (stmts[1].value, exc_name))
    return None


def build_call_args(fn: ast.FunctionDef, main_param, main_lit, nested_param, nested_lit, want_raise: bool):
    """분기가 요구하는 인자 dict(파라미터명 -> 파이썬 값). AST 리터럴 노드는 이미 값으로 치환됨."""
    args = {}
    for a in fn.args.args:
        if a.arg == main_param:
            args[a.arg] = main_lit
        elif a.arg == nested_param:
            args[a.arg] = nested_lit if want_raise else _safe_non_match(nested_lit)
        else:
            args[a.arg] = _default_for_annotation(a.annotation)
    return args


def _safe_non_match(lit):
    if isinstance(lit, (int, float)) and not isinstance(lit, bool):
        return lit + 5 if lit != 5 else lit + 7
    if isinstance(lit, str):
        return lit + "_x"
    return lit


def repr_call(fn_name: str, args: dict) -> str:
    parts = [repr(v) for v in args.values()]
    return f"{fn_name}({', '.join(parts)})"


def run_reference(code: str, fn_name: str, args: dict):
    ns: dict = {}
    exec(code, ns)  # 문항 저작 시점의 신뢰된 정답 코드(외부 입력 아님)
    fn = ns[fn_name]
    try:
        return True, fn(*args.values())
    except Exception as e:
        return False, type(e).__name__


def generate_testcases(q: dict):
    code = str(q.get("answer", ""))
    fn = analyze_function(code)
    if fn is None:
        return None, "구조 미지원(함수 1개+데코레이터없음 조건 불충족)"
    parsed = walk_branches(fn)
    if parsed is None:
        return None, "분기 패턴 미지원(리터럴 == 비교 기반 if/elif/else 아님)"
    main_param, branches = parsed

    testcases = []
    for lit, nested_param, nested_lit, kind, detail in branches:
        main_lit = None if lit == "__else__" else lit
        if main_lit is None:
            main_lit = _safe_non_match(branches[0][0] if branches[0][0] != "__else__" else "x")

        if kind == "return" and nested_param is None:
            args = build_call_args(fn, main_param, main_lit, None, None, False)
            ok, val = run_reference(code, fn.name, args)
            ok2, val2 = run_reference(code, fn.name, args)
            if not ok or ok != ok2 or val != val2:
                return None, f"self-test 불일치({fn.name})"
            testcases.append({"call": repr_call(fn.name, args), "expect": val})
        elif kind == "raise":
            args = build_call_args(fn, main_param, main_lit, None, None, False)
            ok, val = run_reference(code, fn.name, args)
            ok2, val2 = run_reference(code, fn.name, args)
            if ok or ok2 or val != detail or val != val2:
                return None, f"self-test 불일치(raise, {fn.name})"
            testcases.append({"call": repr_call(fn.name, args), "raises": val})
        elif kind == "nested_guard":
            return_expr, exc_name = detail
            args_raise = build_call_args(fn, main_param, main_lit, nested_param, nested_lit, True)
            okr, valr = run_reference(code, fn.name, args_raise)
            okr2, valr2 = run_reference(code, fn.name, args_raise)
            if okr or okr2 or valr != exc_name or valr != valr2:
                return None, f"self-test 불일치(raise, {fn.name})"
            testcases.append({"call": repr_call(fn.name, args_raise), "raises": valr})

            args_ok = build_call_args(fn, main_param, main_lit, nested_param, nested_lit, False)
            oko, valo = run_reference(code, fn.name, args_ok)
            oko2, valo2 = run_reference(code, fn.name, args_ok)
            if not oko or oko != oko2 or valo != valo2:
                return None, f"self-test 불일치(정상경로, {fn.name})"
            testcases.append({"call": repr_call(fn.name, args_ok), "expect": valo})
        else:
            return None, "미지원 분기 형태"
    if not testcases:
        return None, "분기를 찾지 못함"
    return testcases, None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    total = 0
    applied = 0
    unresolved: list = []

    for path in gceo.iter_code_input_files():
        questions = gceo.load_questions(path)
        changed = False
        for q in questions:
            if not isinstance(q, dict) or q.get("type") != "code_input":
                continue
            if not is_empty_output_candidate(q):
                continue
            total += 1
            testcases, reason = generate_testcases(q)
            if testcases is None:
                unresolved.append((q.get("question_id"), reason))
                continue
            applied += 1
            if not args.dry_run:
                q["testcases"] = testcases
                changed = True

        if changed and not args.dry_run:
            full_data = gceo.load_full(path, questions)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(full_data, f, ensure_ascii=False, indent=2)

    print(f"Wave2 대상(빈 출력) {total}개")
    print(f"  자동 테스트케이스 생성: {applied}")
    print(f"  미해결(수동/Cowork 저작 필요): {len(unresolved)}")
    for qid, reason in unresolved:
        print(f"    - {qid}: {reason}")
    if args.dry_run:
        print("(--dry-run: 파일 미변경)")


if __name__ == "__main__":
    main()
