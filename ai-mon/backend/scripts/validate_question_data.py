#!/usr/bin/env python3
"""
Validate AI-MON quiz, boss, training, and stage data.

Run from backend:
  python scripts/validate_question_data.py

The script intentionally uses only the Python standard library so it can run in
CI or during manual regression checks without npm, pytest, or app imports.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"

LEVELS = ("beginner", "intermediate", "advanced")
UNIT_RE = re.compile(r"unit_(\d+)\.json$")
STAGE_RE = re.compile(r"^(\d+)-(\d+)$")

OBJECTIVE_TYPES = {"multiple_choice", "output_select", "error_find"}
SUBJECTIVE_TYPES = {"fill_in_blank", "code_input"}
ALLOWED_TYPES = OBJECTIVE_TYPES | SUBJECTIVE_TYPES

QUESTION_DIRS = ("quiz", "miniboss", "unitboss", "train")
QUESTION_TEXT_FIELDS = ("question", "prompt", "description", "code", "expected_output")
STAGE_TEXT_FIELDS = ("title", "content", "body", "description", "code", "terminal")


@dataclass(frozen=True)
class Issue:
    file: Path
    index: str
    reason: str

    def format(self) -> str:
        try:
            filename = str(self.file.relative_to(BACKEND_DIR))
        except ValueError:
            filename = str(self.file)
        return f"{filename} | index={self.index} | {self.reason}"


def strip_json_comments(raw: str) -> str:
    raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.DOTALL)
    return re.sub(r"(?<!:)//[^\n]*", "", raw)


def load_json(path: Path, issues: list[Issue], *, allow_comments: bool = False) -> Any | None:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        issues.append(Issue(path, "file", f"read error: {exc}"))
        return None

    if allow_comments:
        raw = strip_json_comments(raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        issues.append(Issue(path, "file", f"JSON parse error: line {exc.lineno}, column {exc.colno}: {exc.msg}"))
        return None


def question_items(data: Any, path: Path, issues: list[Issue]) -> list[dict[str, Any]]:
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict) and isinstance(data.get("questions"), list):
        items = data["questions"]
    else:
        issues.append(Issue(path, "file", "expected a question list or an object with questions[]"))
        return []

    result = []
    for idx, item in enumerate(items):
        if isinstance(item, dict):
            result.append(item)
        else:
            issues.append(Issue(path, str(idx), f"question must be an object, got {type(item).__name__}"))
    return result


def lesson_items(data: Any, path: Path, issues: list[Issue]) -> list[dict[str, Any]]:
    if not isinstance(data, list):
        issues.append(Issue(path, "file", "expected a lesson/stage list"))
        return []
    result = []
    for idx, item in enumerate(data):
        if isinstance(item, dict):
            result.append(item)
        else:
            issues.append(Issue(path, str(idx), f"stage item must be an object, got {type(item).__name__}"))
    return result


def nested_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for nested in value.values():
            yield from nested_strings(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from nested_strings(nested)


def check_markdown_and_legacy_fields(path: Path, idx: str, item: dict[str, Any], issues: list[Issue], fields: Iterable[str]) -> None:
    if "code_block" in item:
        issues.append(Issue(path, idx, "legacy code_block field remains"))
    if "split_code_block" in item or "splitCodeBlock" in item:
        issues.append(Issue(path, idx, "legacy split code block field remains"))

    for field in fields:
        if field not in item:
            continue
        fence_count = sum(text.count("```") for text in nested_strings(item[field]))
        if fence_count % 2 == 1:
            issues.append(Issue(path, idx, f"unbalanced markdown code block fences in {field}: count={fence_count}"))


def parse_unit_from_path(path: Path) -> int | None:
    match = UNIT_RE.match(path.name)
    return int(match.group(1)) if match else None


def load_unit_meta(issues: list[Issue]) -> dict[str, dict[int, dict[str, Any]]]:
    files = {
        "beginner": DATA_DIR / "lessons.json",
        "intermediate": DATA_DIR / "lessons_intermediate.json",
        "advanced": DATA_DIR / "lessons_advanced.json",
    }
    meta: dict[str, dict[int, dict[str, Any]]] = {}
    for level, path in files.items():
        data = load_json(path, issues)
        rows = data if isinstance(data, list) else []
        if not isinstance(data, list):
            issues.append(Issue(path, "file", "expected unit metadata list"))
            rows = []
        level_meta: dict[int, dict[str, Any]] = {}
        for idx, row in enumerate(rows):
            if not isinstance(row, dict):
                issues.append(Issue(path, str(idx), "unit metadata row must be an object"))
                continue
            unit_id = row.get("unit_id")
            if not isinstance(unit_id, int):
                issues.append(Issue(path, str(idx), "unit metadata unit_id must be an integer"))
                continue
            stages = row.get("stages")
            if not isinstance(stages, int) or stages < 1:
                issues.append(Issue(path, str(idx), "unit metadata stages must be a positive integer"))
            level_meta[unit_id] = row
        meta[level] = level_meta
    return meta


def is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def validate_question(
    *,
    category: str,
    level: str,
    expected_unit: int | None,
    path: Path,
    idx: int,
    question: dict[str, Any],
    unit_meta: dict[str, dict[int, dict[str, Any]]],
    issues: list[Issue],
) -> None:
    index = str(idx)
    qid = question.get("question_id") or question.get("id")
    if qid:
        index = f"{idx}:{qid}"

    check_markdown_and_legacy_fields(path, index, question, issues, QUESTION_TEXT_FIELDS)

    q_type = question.get("type") or question.get("quiz_type")
    if q_type not in ALLOWED_TYPES:
        issues.append(Issue(path, index, f"unknown question type: {q_type!r}"))
        return

    if "answer" not in question or is_blank(question.get("answer")):
        issues.append(Issue(path, index, "missing or blank answer"))

    if q_type in OBJECTIVE_TYPES:
        choices = question.get("choices")
        if not isinstance(choices, list) or len(choices) == 0:
            issues.append(Issue(path, index, "objective question requires non-empty choices[]"))
        elif any(not isinstance(choice, str) or choice.strip() == "" for choice in choices):
            issues.append(Issue(path, index, "objective question choices[] must contain non-empty strings"))
    elif "choices" in question and question.get("choices") not in (None, []) and not isinstance(question.get("choices"), list):
        issues.append(Issue(path, index, "subjective question choices must be absent, null, or an array"))

    if category != "endboss":
        if expected_unit is None:
            issues.append(Issue(path, index, "could not infer unit from filename"))
        else:
            raw_unit = question.get("unit")
            try:
                actual_unit = int(raw_unit)
            except (TypeError, ValueError):
                issues.append(Issue(path, index, f"unit must match filename unit_{expected_unit}.json, got {raw_unit!r}"))
            else:
                if actual_unit != expected_unit:
                    issues.append(Issue(path, index, f"unit mismatch: filename unit_{expected_unit}.json, item unit={actual_unit}"))
                if actual_unit not in unit_meta.get(level, {}):
                    issues.append(Issue(path, index, f"unit {actual_unit} is not present in {level} unit metadata"))

        item_level = question.get("course_level")
        if item_level is not None and item_level != level:
            issues.append(Issue(path, index, f"course_level mismatch: path={level}, item={item_level!r}"))

    if category in {"quiz", "miniboss"}:
        validate_numbered_stage(path, index, question.get("stage"), expected_unit, level, unit_meta, issues)
    elif category == "unitboss":
        stage = question.get("stage")
        if stage is not None and expected_unit is not None and stage != f"{expected_unit}-boss":
            issues.append(Issue(path, index, f"unitboss stage must be {expected_unit}-boss when present, got {stage!r}"))
    elif category == "endboss":
        item_level = question.get("course_level")
        if item_level is not None and item_level != level:
            issues.append(Issue(path, index, f"course_level mismatch: file={level}, item={item_level!r}"))


def validate_numbered_stage(
    path: Path,
    index: str,
    stage: Any,
    expected_unit: int | None,
    level: str,
    unit_meta: dict[str, dict[int, dict[str, Any]]],
    issues: list[Issue],
) -> None:
    if not isinstance(stage, str):
        issues.append(Issue(path, index, f"stage must be a string like '<unit>-<stage>', got {stage!r}"))
        return
    match = STAGE_RE.match(stage)
    if not match:
        issues.append(Issue(path, index, f"stage must match '<unit>-<stage>', got {stage!r}"))
        return

    stage_unit = int(match.group(1))
    stage_num = int(match.group(2))
    if expected_unit is not None and stage_unit != expected_unit:
        issues.append(Issue(path, index, f"stage unit mismatch: filename unit_{expected_unit}.json, stage={stage!r}"))

    stages = unit_meta.get(level, {}).get(stage_unit, {}).get("stages")
    if isinstance(stages, int) and not (1 <= stage_num <= stages):
        issues.append(Issue(path, index, f"stage {stage!r} is outside {level} unit {stage_unit} stage range 1..{stages}"))


def validate_question_files(unit_meta: dict[str, dict[int, dict[str, Any]]], issues: list[Issue]) -> None:
    for category in QUESTION_DIRS:
        base = DATA_DIR / category
        if not base.is_dir():
            issues.append(Issue(base, "file", "data directory is missing"))
            continue
        for level in LEVELS:
            folder = base / level
            if not folder.is_dir():
                issues.append(Issue(folder, "file", "level directory is missing"))
                continue
            for path in sorted(folder.glob("unit_*.json")):
                data = load_json(path, issues)
                if data is None:
                    continue
                expected_unit = parse_unit_from_path(path)
                questions = question_items(data, path, issues)
                for idx, question in enumerate(questions):
                    validate_question(
                        category=category,
                        level=level,
                        expected_unit=expected_unit,
                        path=path,
                        idx=idx,
                        question=question,
                        unit_meta=unit_meta,
                        issues=issues,
                    )


def validate_endboss_files(unit_meta: dict[str, dict[int, dict[str, Any]]], issues: list[Issue]) -> None:
    base = DATA_DIR / "endboss"
    if not base.is_dir():
        issues.append(Issue(base, "file", "data directory is missing"))
        return

    for level in LEVELS:
        path = base / f"{level}.json"
        if not path.is_file():
            issues.append(Issue(path, "file", "endboss level file is missing"))
            continue
        data = load_json(path, issues, allow_comments=True)
        if data is None:
            continue
        questions = question_items(data, path, issues)
        for idx, question in enumerate(questions):
            validate_question(
                category="endboss",
                level=level,
                expected_unit=None,
                path=path,
                idx=idx,
                question=question,
                unit_meta=unit_meta,
                issues=issues,
            )


def validate_stage_files(unit_meta: dict[str, dict[int, dict[str, Any]]], issues: list[Issue]) -> None:
    base = DATA_DIR / "lessons"
    if not base.is_dir():
        issues.append(Issue(base, "file", "lesson stage directory is missing"))
        return

    for level in LEVELS:
        folder = base / level
        if not folder.is_dir():
            issues.append(Issue(folder, "file", "lesson level directory is missing"))
            continue
        for path in sorted(folder.glob("unit_*.json")):
            data = load_json(path, issues)
            if data is None:
                continue
            expected_unit = parse_unit_from_path(path)
            lessons = lesson_items(data, path, issues)
            for idx, lesson in enumerate(lessons):
                index = str(idx)
                if lesson.get("stage"):
                    index = f"{idx}:{lesson.get('stage')}"
                check_markdown_and_legacy_fields(path, index, lesson, issues, STAGE_TEXT_FIELDS)

                if expected_unit is None:
                    issues.append(Issue(path, index, "could not infer unit from filename"))
                    continue
                raw_unit = lesson.get("unit")
                try:
                    actual_unit = int(raw_unit)
                except (TypeError, ValueError):
                    issues.append(Issue(path, index, f"unit must match filename unit_{expected_unit}.json, got {raw_unit!r}"))
                else:
                    if actual_unit != expected_unit:
                        issues.append(Issue(path, index, f"unit mismatch: filename unit_{expected_unit}.json, item unit={actual_unit}"))

                item_level = lesson.get("course_level")
                if item_level is not None and item_level != level:
                    issues.append(Issue(path, index, f"course_level mismatch: path={level}, item={item_level!r}"))

                validate_numbered_stage(path, index, lesson.get("stage"), expected_unit, level, unit_meta, issues)


def expected_locations() -> list[str]:
    return [
        "quiz: data/quiz/{beginner,intermediate,advanced}/unit_*.json",
        "miniboss: data/miniboss/{beginner,intermediate,advanced}/unit_*.json",
        "unitboss: data/unitboss/{beginner,intermediate,advanced}/unit_*.json",
        "endboss: data/endboss/{beginner,intermediate,advanced}.json",
        "training: data/train/{beginner,intermediate,advanced}/unit_*.json",
        "stage lessons: data/lessons/{beginner,intermediate,advanced}/unit_*.json",
        "unit metadata: data/lessons.json, data/lessons_intermediate.json, data/lessons_advanced.json",
    ]


def main() -> int:
    issues: list[Issue] = []
    unit_meta = load_unit_meta(issues)
    validate_question_files(unit_meta, issues)
    validate_endboss_files(unit_meta, issues)
    validate_stage_files(unit_meta, issues)

    print("Question data validation")
    print("Checked locations:")
    for location in expected_locations():
        print(f"  - {location}")

    if issues:
        print(f"\nFAILED: {len(issues)} issue(s)")
        for issue in issues:
            print(issue.format())
        return 1

    print("\nOK: question, boss, training, and stage data passed validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
