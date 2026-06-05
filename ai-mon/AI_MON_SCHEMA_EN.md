---
notion_page: https://app.notion.com/p/AI-MON-SCHEMA-373ea473fb4581968fa1fb9a1ba08a83
title: AI MON SCHEMA (EN)
---
# AI MON Data Schema
> Field definitions + examples for each JSON file. Reference document for question data creation and development integration.

---

## 1. lessons.json (Unit List)

Metadata for each lesson displayed in the unit list on the main home screen.

| Field | Type | Required | Description |
|---|---|---|---|
| `unit_id` | number | ✅ | Unit number (e.g. `1`) |
| `title` | string | ✅ | Unit title (e.g. `"First Steps in Python"`) |
| `description` | string | ✅ | Unit description |
| `stages` | number | ✅ | Number of stages in this unit (e.g. `4`) |
| `boss_stage` | number | ✅ | Boss stage number (e.g. `5`) |
| `icon` | string | ✅ | Card icon emoji (e.g. `"🖨️"`) |
| `keywords` | array | ✅ | Hashtag list (e.g. `["print", "variable"]`) |
| `evolution` | string | ✅ | Pet evolution stage unlocked by completing this unit (e.g. `"slime"`) |
| `difficulty` | string | ✅ | Difficulty label (e.g. `"Intro"`) |

---

## 1-1. lessons/ Folder (Briefing Slide Data)

Briefing slide data — concept explanations per stage × level combination

### 📁 File Management Structure

```
backend/data/lessons/
├── unit_1.json   ← All stage × level slides for Unit 1
├── unit_2.json
...
└── unit_8.json
```

Each file is an **array** containing all `stage × course_level` combinations within one unit.
The backend automatically reads and merges the files in the `lessons/` folder to serve them.

---

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `lesson_id` | string | ✅ | `"{stage}-{course_level}"` format (e.g. `"1-1-beginner"`) |
| `unit` | number | ✅ | Unit number (1–8) |
| `stage` | string | ✅ | Stage number (e.g. `"1-1"`) |
| `course_level` | string | ✅ | Enrollment level: `beginner` / `intermediate` / `advanced` |
| `title` | string | ✅ | Stage title |
| `villain` | string | ✅ | Appearing villain (`codemmon` / `speechbubble_king` / `interferencemon`) |
| `slides` | array | ✅ | List of slides |
| `slides[].order` | number | ✅ | Slide order |
| `slides[].text` | string | ✅ | Concept explanation text |
| `slides[].terminal` | object | ❌ | Terminal example (may be absent) |
| `slides[].terminal.code` | array | ❌ | Array of code lines |
| `slides[].terminal.output` | array | ❌ | Array of execution output lines |
| `slides[].tip` | string | ❌ | Bottom tip text |

---

### Teaching Strategy by Level

| `course_level` | Teaching Strategy | Key Concepts for Stage 1-1 |
|---|---|---|
| `beginner` | Analogy-first, one concept at a time, plain language | print() = speaker analogy, role of quotes, basic comments (`#`) |
| `intermediate` | Practical comparison, difference-focused | `,` vs `+` spacing difference, `str()` type conversion, inline comments |
| `advanced` | Deep-dive on parameters, Pythonic patterns | `sep`/`end` parameters, f-string formatting, `*` unpacking |

> Within the same `stage`, only `course_level` changes; `title` and `villain` remain identical.

---

### Example (excerpt from unit_1.json)

```json
[
  {
    "lesson_id": "1-1-beginner",
    "unit": 1,
    "stage": "1-1",
    "course_level": "beginner",
    "title": "Hello, Python!",
    "villain": "codemmon",
    "slides": [
      {
        "order": 1,
        "text": "In Python, use print() to display text on screen.\nLike a speaker, it outputs whatever you put inside the parentheses.",
        "terminal": {
          "code": ["print('Hello, AI-Mon!')"],
          "output": ["Hello, AI-Mon!"]
        },
        "tip": "Quotes are the signal that tells Python: 'this is text!'"
      }
    ]
  },
  {
    "lesson_id": "1-1-intermediate",
    "unit": 1,
    "stage": "1-1",
    "course_level": "intermediate",
    "title": "Hello, Python!",
    "villain": "codemmon",
    "slides": [ ... ]
  },
  {
    "lesson_id": "1-1-advanced",
    "unit": 1,
    "stage": "1-1",
    "course_level": "advanced",
    "title": "Hello, Python!",
    "villain": "codemmon",
    "slides": [ ... ]
  },
  {
    "lesson_id": "1-2-beginner",
    "unit": 1,
    "stage": "1-2",
    "course_level": "beginner",
    "slides": [ ... ]
  }
]
```

---

## 2. questions.json

Quiz question data — unified management of stage quizzes + boss questions

| Field | Type | Allowed Values | Required | Description |
|---|---|---|---|---|
| `question_id` | string | - | ✅ | Question ID. Stage: `q{number}` / Boss: `boss_{level}_{type}_{unit}_{number}` |
| `unit` | number | 1–8 | ✅ | Unit number |
| `stage` | string | - | ✅ | Stage number (`"1-1"`, `"1-boss"`, etc.) |
| `course_level` | string | beginner / intermediate / advanced | ✅ | Enrollment level |
| `difficulty` | string | easy / medium / hard | ✅ | Question difficulty |
| `type` | string | multiple_choice / output_select / fill_in_blank / code_input | ✅ | Question type |
| `is_boss` | boolean | true / false | ✅ | Whether this is a boss question (used with `stage: "1-boss"`) |
| `question` | string | - | ✅ | Question text |
| `choices` | array | - | ❌ | Answer choices (only for multiple_choice / output_select; empty array for fill_in_blank) |
| `answer` | string | - | ✅ | Correct answer |
| `hint` | string | - | ✅ | Hint text |
| `feedback.correct` | string | - | ✅ | Text shown on correct answer (no API call) |
| `feedback.wrong` | string | - | ✅ | Base text on wrong answer → replaced by Claude API |

> `stage: "1-boss"` + `is_boss: true` combination identifies boss questions.

### question_id Naming Rules

| Category | Pattern | Example |
|---|---|---|
| Stage beginner | `q{3-digit}` | `q001`, `q002`, `q003` |
| Stage intermediate | `q{starts with 1, 3-digit}` | `q101`, `q102`, `q103` |
| Stage advanced | `q{starts with 2, 3-digit}` | `q201`, `q202`, `q203` |
| Boss | `boss_{level}_{type}_{unit}_{number}` | `boss_beg_mc_1_001` |

```json
{
  "questions": [
    {
      "question_id": "q001",
      "unit": 1,
      "stage": "1-1",
      "course_level": "beginner",
      "difficulty": "easy",
      "type": "multiple_choice",
      "is_boss": false,
      "question": "What does print() do?",
      "choices": ["A. Stores a value", "B. Outputs a value", "C. Deletes a value", "D. Calculates a value"],
      "answer": "B. Outputs a value",
      "hint": "It's the function used to show something on screen.",
      "feedback": {
        "correct": "Correct! print() outputs a value to the screen.",
        "wrong": "print() is used to display text or numbers on the screen."
      }
    },
    {
      "question_id": "boss_beg_mc_1_001",
      "unit": 1,
      "stage": "1-boss",
      "course_level": "beginner",
      "difficulty": "hard",
      "type": "multiple_choice",
      "is_boss": true,
      "question": "Which of the following lines does NOT execute in Python?",
      "choices": ["A. print('AI-Mon')", "B. # print('AI-Mon')", "C. print('# AI-Mon')", "D. print('AI-Mon') # output"],
      "answer": "B",
      "hint": "What happens when # appears at the very start of a line?",
      "feedback": {
        "correct": "Correct! A # at the start of a line makes the entire line a comment.",
        "wrong": "A # at the start of a line makes the entire line a comment."
      }
    }
  ]
}
```

---

## 3. users.json

User information

| Field | Type | Allowed Values | Required | Description |
|---|---|---|---|---|
| `user_id` | string | - | ✅ | Unique user ID |
| `nickname` | string | - | ✅ | Display name |
| `course_level` | string | beginner / intermediate / advanced | ✅ | Enrollment level |
| `is_level_tested` | boolean | true / false | ✅ | Whether level test has been completed |
| `xp` | number | 0+ | ✅ | XP held |
| `lv` | number | 1–40 | ✅ | Current level |
| `crowns` | number | 0+ | ✅ | Crowns held |
| `streak` | number | 0+ | ✅ | Consecutive login days |
| `last_login` | string | YYYY-MM-DD | ✅ | Last login date (for streak calculation) |
| `avatar_stage` | string | slime / robot / speech_bubble / final_ghost | ✅ | Current character evolution stage |
| `created_at` | string | YYYY-MM-DD | ✅ | Sign-up date |

```json
{
  "user_id": "u001",
  "nickname": "Jinny",
  "course_level": "beginner",
  "is_level_tested": true,
  "xp": 320,
  "lv": 5,
  "crowns": 5,
  "streak": 3,
  "last_login": "2026-06-02",
  "avatar_stage": "slime",
  "created_at": "2026-06-01"
}
```

---

## 4. progress.json

User learning progress

| Field | Type | Allowed Values | Required | Description |
|---|---|---|---|---|
| `user_id` | string | - | ✅ | User ID |
| `course_level` | string | beginner / intermediate / advanced | ✅ | Enrollment level |
| `final_boss.status` | string | locked / in_progress / completed | ✅ | Final boss status |
| `final_boss.attempts` | number | 0+ | ✅ | Final boss attempt count |
| `units[].unit` | number | 1–8 | ✅ | Unit number |
| `units[].status` | string | locked / in_progress / completed | ✅ | Unit status |
| `units[].stages[].stage` | string | - | ✅ | Stage number |
| `units[].stages[].status` | string | locked / in_progress / completed | ✅ | Stage status |
| `units[].stages[].score` | number | 0–100 | ❌ | Quiz score |
| `units[].stages[].attempts` | number | 0+ | ✅ | Attempt count |
| `units[].stages[].completed_at` | string | YYYY-MM-DD | ❌ | Clear date |
| `units[].boss.status` | string | locked / in_progress / completed | ✅ | Boss status |
| `units[].boss.attempts` | number | 0+ | ✅ | Total boss attempt count |
| `units[].boss.boss_attempts_today` | number | 0+ | ✅ | Today's boss attempts (limit: 2 per day) |
| `units[].boss.last_attempt_date` | string | YYYY-MM-DD | ❌ | Last attempt date |
| `units[].boss.hints_used` | number | 0–2 | ✅ | Hints used count |
| `units[].training.status` | string | locked / in_progress / completed | ✅ | Training status (post-MVP) |
| `units[].training.score` | number | 0–100 | ❌ | Training score |
| `units[].training.attempts` | number | 0+ | ✅ | Training attempt count |

```json
{
  "user_id": "u001",
  "course_level": "beginner",
  "final_boss": { "status": "locked", "attempts": 0 },
  "units": [{
    "unit": 1,
    "status": "in_progress",
    "stages": [
      {
        "stage": "1-1",
        "status": "completed",
        "score": 100,
        "attempts": 1,
        "completed_at": "2026-06-02"
      }
    ],
    "boss": {
      "status": "locked",
      "attempts": 0,
      "boss_attempts_today": 0,
      "last_attempt_date": null,
      "hints_used": 0
    },
    "training": { "status": "locked", "score": null, "attempts": 0 }
  }]
}
```

---

## 5. wrong_answers.json

Wrong-answer notes (activated post-MVP)

| Field | Type | Allowed Values | Required | Description |
|---|---|---|---|---|
| `user_id` | string | - | ✅ | User ID |
| `wrong_answers[].question_id` | string | - | ✅ | Question ID |
| `wrong_answers[].unit` | number | 1–8 | ✅ | Unit number |
| `wrong_answers[].stage` | string | - | ✅ | Stage number |
| `wrong_answers[].course_level` | string | beginner / intermediate / advanced | ✅ | Enrollment level |
| `wrong_answers[].type` | string | multiple_choice / output_select / fill_in_blank / code_input | ✅ | Question type |
| `wrong_answers[].question` | string | - | ✅ | Question text |
| `wrong_answers[].choices` | array | - | ❌ | Answer choices |
| `wrong_answers[].user_answer` | string | - | ✅ | User's submitted answer |
| `wrong_answers[].correct_answer` | string | - | ✅ | Correct answer |
| `wrong_answers[].ai_explanation` | string | - | ❌ | Claude AI explanation (stored to avoid re-calling the API) |
| `wrong_answers[].wrong_count` | number | 1+ | ✅ | Number of times wrong |
| `wrong_answers[].reviewed` | boolean | true / false | ✅ | Whether re-attempted in wrong-answer notes |
| `wrong_answers[].last_wrong_at` | string | YYYY-MM-DD | ✅ | Most recent wrong date |
| `wrong_answers[].created_at` | string | YYYY-MM-DD | ✅ | First wrong date |

```json
{
  "user_id": "u001",
  "wrong_answers": [{
    "question_id": "q_1_1_easy",
    "unit": 1,
    "stage": "1-1",
    "course_level": "beginner",
    "type": "multiple_choice",
    "question": "What is printed when print('Hello') runs?",
    "choices": ["Hello", "'Hello'", "print(Hello)", "Error"],
    "user_answer": "'Hello'",
    "correct_answer": "Hello",
    "ai_explanation": "",
    "wrong_count": 1,
    "reviewed": false,
    "last_wrong_at": "2026-06-02",
    "created_at": "2026-06-02"
  }]
}
```

---

## 6. Actual Question Data (Unit 1 · Stage 1-1)

> Actual questions produced for Stage 1-1. Separated by beginner / intermediate / advanced level and screen.

---

### beginner

**stage_lesson — multiple_choice**

```json
{
  "type": "stage_lesson", "level": "beginner", "quiz_type": "multiple_choice",
  "unit": 1, "stage": "1-1", "pass_score": 80,
  "questions": [
    { "question_id": "sl_beg_mc_1_1_001", "type": "multiple_choice",
      "question": "What does print() do?",
      "choices": ["A. Stores a value","B. Outputs a value","C. Deletes a value","D. Calculates a value"],
      "answer": "B", "explanation": "print() is a function that outputs whatever is inside the parentheses to the screen." },
    { "question_id": "sl_beg_mc_1_1_002", "type": "multiple_choice",
      "question": "What symbol is used to write a comment in Python?",
      "choices": ["A. //","B. --","C. #","D. /*"],
      "answer": "C", "explanation": "Anything after # on the same line is ignored by Python." },
    { "question_id": "sl_beg_mc_1_1_003", "type": "multiple_choice",
      "question": "Which of the following is the correct way to use print()?",
      "choices": ["A. print[Hello]","B. print Hello","C. print('Hello')","D. Print('Hello')"],
      "answer": "C", "explanation": "print() is lowercase, and the output must be inside parentheses wrapped in quotes." }
  ]
}
```

**concept_check — multiple_choice**

```json
{
  "type": "concept_check", "level": "beginner", "quiz_type": "multiple_choice",
  "unit": 1, "stage": "1-1", "villain": "codemmon", "pass_score": 80,
  "questions": [
    { "question_id": "cc_beg_mc_1_1_001",
      "question": "What does print('AI-Mon') display on screen?",
      "choices": ["A. 'AI-Mon'","B. AI-Mon","C. print(AI-Mon)","D. Error"],
      "answer": "B", "explanation": "Quotes just indicate a string. The screen shows AI-Mon without the quotes." },
    { "question_id": "cc_beg_mc_1_1_002",
      "question": "Which of the following lines is commented out?",
      "choices": ["A. print('Hello')","B. # print('Hello')","C. //print('Hello')","D. --print('Hello')"],
      "answer": "B", "explanation": "When # appears at the front, the entire line becomes a comment." }
  ]
}
```

**boss — multiple_choice + output_select**

```json
{
  "type": "boss", "level": "beginner", "unit": 1, "boss_name": "Code-mon Unit 1 Boss",
  "pass_score": 80, "free_attempts_per_day": 2, "crown_cost_from_attempt": 3,
  "hints_allowed": 2, "xp_reward": 2000,
  "questions": [
    { "question_id": "boss_beg_mc_1_001", "type": "multiple_choice",
      "question": "Which of the following lines does NOT execute in Python?",
      "choices": ["A. print('AI-Mon')","B. # print('AI-Mon')","C. print('# AI-Mon')","D. print('AI-Mon') # output"],
      "answer": "B", "explanation": "A # at the start of a line makes the entire line a comment." },
    { "question_id": "boss_beg_os_1_001", "type": "output_select",
      "question": "Choose the correct output of the following code.\n\nprint('Defeat' + ' ' + 'Code-mon!')\n# print('Game Over')\nprint('Victory!')",
      "choices": ["A. Defeat Code-mon! / Game Over / Victory!","B. Defeat Code-mon! / Victory!","C. Defeat + + Code-mon! / Victory!","D. Error"],
      "answer": "B", "explanation": "+ concatenates strings; the # comment line is ignored." }
  ]
}
```

**final_boss — output_select + fill_in_blank (hints_allowed: 0)**

```json
{
  "type": "final_boss", "level": "beginner", "boss_name": "Final Boss — Black AI-Mon",
  "unlock_condition": "Unlocks after Unit 8 Boss clear", "hints_allowed": 0, "xp_reward": 5000,
  "questions": [
    { "question_id": "fb_beg_os_001", "type": "output_select",
      "question": "Choose the correct output of the following code.\n\nname = 'AI-Mon'\nlevel = 8\nprint(f'{name} has reached Lv.{level} Final Evolution!')\n# print('I miss the slime days')\nprint('Congratulations!')",
      "choices": ["A. AI-Mon has reached Lv.8 Final Evolution! / I miss the slime days / Congratulations!","B. AI-Mon has reached Lv.8 Final Evolution! / Congratulations!","C. {name} has reached Lv.{level} Final Evolution! / Congratulations!","D. Error"],
      "answer": "B", "explanation": "f-strings replace variables in {}. # comments are ignored." },
    { "question_id": "fb_beg_fib_001", "type": "fill_in_blank",
      "question": "Fill in the blank to output 'AI-Mon Final Evolution Complete!'.\n\n_____('AI-Mon Final Evolution Complete!')",
      "answer": "print", "explanation": "The print() function outputs whatever is inside the parentheses to the screen." }
  ]
}
```

---

### intermediate

**stage_lesson — multiple_choice + output_select**

```json
{
  "type": "stage_lesson", "level": "intermediate", "quiz_type": "multiple_choice",
  "unit": 1, "stage": "1-1", "pass_score": 80,
  "questions": [
    { "question_id": "sl_mid_mc_1_1_001",
      "question": "Which statement correctly describes the difference between comma (,) and + in print()?",
      "choices": ["A. Both concatenate without spaces","B. + adds a space; comma adds none","C. Comma auto-inserts a space; + concatenates without space","D. Both behave the same"],
      "answer": "C", "explanation": "A comma (,) causes print() to automatically insert a space between values." },
    { "question_id": "sl_mid_os_1_1_001", "type": "output_select",
      "question": "Choose the correct output of the following code.\n\nprint('AI-Mon', 'Lv', 5)\nprint('AI-Mon' + 'Lv' + str(5))",
      "choices": ["A. AI-Mon Lv 5 / AI-MonLv5","B. AI-MonLv5 / AI-Mon Lv 5","C. AI-Mon Lv 5 / AI-Mon Lv 5","D. Error"],
      "answer": "A", "explanation": "Comma auto-inserts spaces; + concatenates without space." }
  ]
}
```

**boss — output_select + fill_in_blank**

```json
{
  "type": "boss", "level": "intermediate", "unit": 1,
  "pass_score": 80, "free_attempts_per_day": 2, "crown_cost_from_attempt": 3,
  "hints_allowed": 2, "xp_reward": 2000,
  "questions": [
    { "question_id": "boss_mid_os_1_001", "type": "output_select",
      "question": "Choose the correct output of the following code.\n\nname = 'AI-Mon'\nhp = 100\nprint(f'{name} HP: {hp - 30}')\n# print('Taking damage!')\nprint(f'Remaining HP: {hp - 30}')",
      "choices": ["A. AI-Mon HP: 100 / Taking damage! / Remaining HP: 70","B. AI-Mon HP: 70 / Remaining HP: 70","C. AI-Mon HP: {hp - 30} / Remaining HP: {hp - 30}","D. Error"],
      "answer": "B", "explanation": "Expressions inside f-string {} are evaluated. # comments are ignored." },
    { "question_id": "boss_mid_fib_1_001", "type": "fill_in_blank",
      "question": "Fill in the blank to output using an f-string.\n\nxp = 2000\nprint(___'AI-Mon Boss Clear! XP: {xp}')",
      "answer": "f", "explanation": "An f-string is created by prefixing the string with f." }
  ]
}
```

---

### advanced

**stage_lesson — output_select + fill_in_blank**

```json
{
  "type": "stage_lesson", "level": "advanced", "unit": 1, "stage": "1-1", "pass_score": 80,
  "questions": [
    { "question_id": "sl_adv_os_1_1_001", "type": "output_select",
      "question": "Choose the correct output of the following code.\n\nfor i in range(3):\n    print(i, end='-')\nprint('end')",
      "choices": ["A. 0-1-2-end","B. 0 / 1 / 2 / end","C. 0-1-2- / end","D. 012-end"],
      "answer": "A", "explanation": "end='-' replaces the newline with a dash." },
    { "question_id": "sl_adv_fib_1_1_001", "type": "fill_in_blank",
      "question": "Fill in the blank so that print() separates multiple values with |.\nTarget output: AI-Mon|Robot|Ghost\n\nprint('AI-Mon', 'Robot', 'Ghost', _____='|')",
      "answer": "sep", "explanation": "The sep parameter specifies the separator between multiple values." }
  ]
}
```

**boss — fill_in_blank + code_input**

```json
{
  "type": "boss", "level": "advanced", "unit": 1,
  "pass_score": 80, "hints_allowed": 2, "xp_reward": 2000, "pyodide_eval": true,
  "questions": [
    { "question_id": "boss_adv_fib_1_001", "type": "fill_in_blank",
      "question": "Fill in the blank to format a number to 3 decimal places and print it.\n\nscore = 98.7564\nprint(f'Score: {score:_____}')",
      "answer": ".3f", "explanation": ":.3f rounds and outputs to 3 decimal places." },
    { "question_id": "boss_adv_ci_1_001", "type": "code_input",
      "question": "Print the list [1, 2, 3, 4, 5] on one line separated by spaces. Use print() only once.\nTarget output: 1 2 3 4 5",
      "answer": "print(*[1, 2, 3, 4, 5])", "pyodide_eval": true }
  ]
}
```

**final_boss — code_input-heavy (hints_allowed: 0)**

```json
{
  "type": "final_boss", "level": "advanced", "hints_allowed": 0, "xp_reward": 5000,
  "pyodide_eval": true,
  "questions": [
    { "question_id": "fb_adv_ci_001", "type": "code_input",
      "question": "Define the function show_status(name, level, hp)\nCall show_status('AI-Mon', 40, 9999)\nTarget output: [ AI-Mon ] Lv.40 | HP: 9999",
      "answer": "def show_status(name, level, hp):\n    print(f'[ {name} ] Lv.{level} | HP: {hp}')\n\nshow_status('AI-Mon', 40, 9999)", "pyodide_eval": true },
    { "question_id": "fb_adv_ci_002", "type": "code_input",
      "question": "From scores = [72, 88, 95, 61, 100], filter and print only scores of 80 or above.\nTarget output: 88 / 95 / 100",
      "answer": "scores = [72, 88, 95, 61, 100]\nfor score in scores:\n    if score >= 80:\n        print(score)", "pyodide_eval": true }
  ]
}
```
