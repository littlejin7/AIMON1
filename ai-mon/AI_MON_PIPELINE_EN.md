---
notion_page: https://app.notion.com/p/AI-MON-PIPELINE-373ea473fb45813a8d91cd58551751ab
title: AI MON PIPELINE (EN)
---
# AI MON Pipeline Overview
> Live reference document — translated from the Korean pipeline spec.
> Note: All in-product UI text remains in Korean as designed.

---

## 1. Terminology

| Concept | Term |
|---|---|
| Top-level difficulty tier | beginner / intermediate / advanced |
| Large unit | Unit |
| Small unit | Stage |
| Questions inside a stage | Quiz |
| Final challenge of a unit | Boss |
| Final challenge of a tier | Final Boss (black character) |
| Post-unit review mode | Training |

---

## 2. Overall Structure

```
Lesson category (MVP: 3 tabs / Phase 2: 4 tabs)
└ Unit 1
    └ Stage 1-1 · Topic name
         └ Briefing (concept slides + terminal + tip)
         └ Quiz
    └ Stage 1-2 · Topic name
         └ Briefing
         └ Quiz
    └ ...
    └ Boss
    └ Training (unlocks after unit clear)
└ Units 2–8 (same structure)
└ Final Boss (unlocks after all units in tier are complete)
```

Enter Stage → Flip through briefing slides → Quiz → Unlock next stage

- All tiers share the same curriculum topics; **only the question sets differ by difficulty**
- beginner: concept comprehension, multiple_choice
- intermediate: code reading + simple code_input, mixed
- advanced: code writing + application, code_input-heavy

**Navigation**
- MVP: Lesson / Training / My Character (3 tabs)
- Phase 2: Lesson / Training / Mini-game / My Character (4 tabs)

---

## 3. Learning Flow Pipeline

### Stage Progression
```
Lesson → Quiz → Unlock next stage
```
- Stage order within a unit is enforced (no skipping)
- Unit order is enforced (Unit 2 opens only after Unit 1 is complete)
- Crowns awarded on unit unlock (unit number = crowns, e.g. Unit 2 unlock = 2 crowns)

### Quiz Pass Criteria
- Concept-check quiz: **80%+** to pass
  - Units 1–3: 3 questions / Units 4–6: 4 questions / Units 7–8: 5 questions
- Training (review) quiz: **90%+** to pass
  - beginner: 10 questions / intermediate: 12 / advanced: 15
- Below threshold: re-attempt only the wrong questions

### Boss Challenge
```
Unit quiz 80% pass → Boss unlocked → Challenge
```
- 2 free attempts per day
- From the 3rd attempt: 1 crown consumed per attempt
- Lessons cannot be skipped; Boss-only attempts are not allowed

---

## 4. AI Feedback Pipeline

```
User submits wrong answer (multiple_choice or code_input)
    ↓
Wrong-answer judgement
    ↓
Explanation level selected (saved in settings, changeable anytime)
    ↓
beginner / intermediate / advanced
    ↓
Claude API call
  system: level-specific prompt
  user: question + user's answer + correct answer
    ↓
Response received (MVP: full response then display / later: SSE streaming)
    ↓
Inline display on question screen
  - Available immediately
  - Separated from the hint area (requires crowns)
    ↓
Retry button shown + wrong-answer note auto-saved
```

| Level | Explanation Style |
|---|---|
| beginner | Analogy + everyday example + why it was wrong |
| intermediate | Concept + code example + error cause analysis |
| advanced | Underlying principle + edge cases + optimal solution |

**Confirmed**
- Explanation level: set once, fixed; changeable in Settings anytime
- API output mode: MVP delivers full response, then switches to streaming
- Correct answer: outputs `explanation` field text directly (no API call)
- Wrong answer: calls Claude API → level-specific feedback (applied every stage)
- No API call limit (called only on wrong answers, so cost is minimal)

**Pending**
- [ ] Confirm FastAPI SSE compatibility with Replit (when switching to streaming)

---

## 5. Code Execution Pipeline

- **Method:** Pyodide (in-browser Python execution — no server required)

```
User writes code
    ↓
Executed directly by browser Pyodide engine (JS → WASM)
    ↓
Execution result returned (stdout / stderr)
    ↓
Front-end displays result + compares against correct answer
```

---

## 6. Question Data Structure

- **Storage:** JSON (MVP) → DB migration later (SQLite → PostgreSQL)
- **Files:** lessons.json / questions.json / users.json / progress.json / wrong_answers.json
- **Full field definitions and examples →** 📋 AI MON Data Schema page

**Hint Rules**
- Stage: no hints
- Boss: 2 hints (`hints_used` managed as 0–2)
- Final Boss: no hints (field absent)
- Final Boss: unlocks after Unit 8 Boss clear

---

## 7. XP & Character Evolution System

- **XP purpose:** does NOT trigger evolution — used only as currency (custom item purchases)
- **Character evolution:** triggered by unit completion

```
Unit 3 complete → slime → robot
Unit 6 complete → robot → speech_bubble
Unit 8 complete → speech_bubble → final_ghost
```

---

## 8. Crown Logic

**Earned**
- On unit unlock: crowns equal to the unit number (Unit 2 unlock = 2 crowns)
- On completing a day's Training: 1 crown

**Spent**
- From the 3rd Boss attempt onward: 1 crown per attempt
- Custom item purchases: per-item price (TBD)

**When 0 crowns remain on 3rd Boss attempt**
- MVP: block attempt, show "Not enough crowns"
- Phase 2: link to Mini-game (Game A / B) → earn crowns on clear

**Mini-games (post-MVP)**
- Game A: casual time-killer (Anipang-style) → earn crowns
- Game B: AI knowledge game (card battle / O-X quiz, 2–3 types) → earn XP 100–300 (varies by difficulty)
- Navigation: Lesson / Training / **Mini-game** / My Character (nav bar expands to 4 tabs post-MVP)

---

## 9. Auth / Login Pipeline

### Guest Landing Flow

```
App entry (guest landing / main)
     │
     ├── 1. [Login / I already have an account]
     │    /auth?mode=login
     │
     └── 2. [Start Level Test (for guests)]
          /level-test-info info page
          └─ "Sign up and take the level test" → /auth?mode=register
```

### Post-Login Dashboard Flow

```
Login complete (dashboard entry)
     │
     ├── Level test not yet taken (is_level_tested: false)
     │    └─ [Diagnose my coding level] button shown in the center
     │    └─ On click → level test modal → on complete: update course_level, is_level_tested
     │
     └── Level test completed (is_level_tested: true)
          └─ Diagnosis button hidden
          └─ Current level badge (e.g. intermediate) shown in the top user info area
```

### Auth Page (/auth)

- URL param: `?mode=login|register`
- **Social login (UI frame):** Google / Kakao / Naver OAuth buttons (to be implemented later)
- After sign-up, user is directed to dashboard with a prompt to take the level test

### RegisterRequest Schema (backend)

```python
class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    course_level: str = "beginner"
    is_level_tested: bool = False
```

### users.json stored fields

| Field | Type | Description |
|------|------|------|
| `id` | UUID | Auto-generated |
| `username` | str | Login ID |
| `nickname` | str | Display name |
| `course_level` | str | beginner / intermediate / advanced |
| `is_level_tested` | bool | Whether level test is completed |
| `character` | str | "default" |
| `created_at` | ISO 8601 | Sign-up timestamp |

- After login: `users.json` / `progress.json` created and saved

---

## 10. XP Level System

**Level-up XP thresholds**
```
Lv 1→5:   1,000 XP per level
Lv 6→15:  2,500 XP per level
Lv 16→25: 5,000 XP per level
Lv 26→35: 10,000 XP per level
Lv 36→40: 20,000 XP per level
```

**XP Sources**
```
Stage quiz clear:    500 XP
Boss clear:          2,000 XP
Training complete:   1,000 XP
3-day streak:        500 XP
7-day streak:        2,000 XP + 1 crown
14-day streak:       5,000 XP + 2 crowns
30-day streak:       10,000 XP + 5 crowns
```

---

## 11. Streak Logic

- Daily login: streak +1
- Miss a day: streak resets to 0
- Tracked via `last_login` field

**Streak rewards (default intervals, auto-granted)**
```
3 days   → 500 XP
7 days   → 2,000 XP + 1 crown
14 days  → 5,000 XP + 2 crowns
30 days  → 10,000 XP + 5 crowns
```

---

## 12. My Character Screen

**Displayed Info**
- Current evolution stage (slime / robot / speech_bubble / final_ghost)
- Current Lv + XP progress bar
- Crowns held

**Customization**
- Use crowns to purchase and apply character color palettes & effects
- Terminal theme unlock: planned post-MVP

**Evolution Condition Display**
- Show how many units remain until next evolution (e.g. "Evolves on Unit 6 clear")

---

## 13. Screen List (MVP)

**Main / Navigation**
- Home (progress overview + today's study prompt)
- Navigation bar (Lesson / Training / My Character)

**Lesson Flow**
- Lesson Home (tier select + unit list)
- Unit Detail (stage list + lock state)
- Briefing screen (concept slides + terminal + tip)
- Stage quiz screen (question + choices or code_input)
- Correct-answer screen (explanation output)
- Wrong-answer screen (Claude AI feedback + retry button)
- Loading screen (shown during API calls)
- Boss challenge screen
- Boss clear screen (XP earned + crown animation + cert card preview)

**Auth**
- Onboarding (Stage 1-1 guest experience)
- Sign-up / Login modal

**My Character**
- Character screen (evolution state + XP bar + crown count)

**Settings**
- AI explanation level setting (beginner / intermediate / advanced)

---

## 14. API Endpoints (MVP)

**Auth**
```
POST /auth/register     Sign up
POST /auth/login        Login → issue JWT
```

**User**
```
GET  /user/me           Fetch my info (XP, crowns, level, streak)
```

**Briefing / Lesson**
```
GET  /lessons                      All lessons list (auto-merged from lessons/unit_N.json)
GET  /lessons/{lesson_id}          Specific lesson (lesson_id e.g. "1-1-beginner")
```

**Quiz**
```
GET  /quiz/{level}/{unit}/{stage}   Fetch stage questions
POST /quiz/submit                   Submit answer → correct/wrong judgement
POST /quiz/ai-feedback              Call Claude API on wrong answer
```

**Progress**
```
GET  /progress          Fetch full progress
POST /progress/update   Mark stage/unit complete
```

**Boss**
```
GET  /boss/{unit}       Fetch boss info
POST /boss/attempt      Start boss attempt (deduct crown)
POST /boss/clear        Process boss clear (grant XP + crowns + check evolution)
POST /boss/fail         Process boss fail (update attempt count)
```

**Code Execution**
```
# No backend endpoint
# code_input grading is handled entirely by front-end Pyodide (in-browser execution)
```

**Mini-game (post-MVP)**
```
GET  /game/list         Mini-game list
POST /game/clear        Game clear → grant crowns/XP
```

---

## 15. Folder Structure

```
ai-mon/
├── frontend/                 # React + Vite
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── QuizCard/
│       │   ├── BossCard/
│       │   ├── CharacterDisplay/
│       │   └── NavBar/
│       ├── pages/
│       │   ├── Home/         # Landing + logged-in dashboard (level test modal included)
│       │   ├── Lesson/       # Unit list (LessonHome) + stage list (Lesson)
│       │   ├── Stage/        # Briefing + quiz combined (Stage.jsx)
│       │   ├── Boss/
│       │   ├── Character/
│       │   ├── Settings/
│       │   └── Auth/
│       ├── data/
│       │   └── mockData.js   # Local dev mock data (MOCK_LESSONS, MOCK_QUESTIONS)
│       ├── hooks/
│       ├── api/
│       └── App.jsx
│
├── backend/                  # FastAPI
│   ├── main.py
│   ├── routers/
│   │   ├── auth.py           # POST /auth/register, /auth/login
│   │   ├── quiz.py           # GET /lessons, /lessons/{id}, /questions, /ai-feedback
│   │   ├── boss.py
│   │   ├── progress.py
│   │   ├── user.py
│   │   └── code.py
│   ├── services/
│   │   ├── claude_service.py
│   │   └── gemini_service.py
│   └── data/
│       ├── lessons/          ← Per-unit briefing slides (folder, managed manually)
│       │   ├── unit_1.json   ← Stage 1-1~1-N × beginner/intermediate/advanced
│       │   └── unit_N.json   ← (added later)
│       ├── questions.json    ← Managed manually in Replit
│       ├── users.json        ← Auto-generated (on sign-up)
│       ├── progress.json     ← Auto-generated (on progress save)
│       └── wrong_answers.json ← Auto-generated (on wrong answer)
│
├── .env
└── .gitignore
```

---

## 16. Quiz Type Definitions

| Type | Description | Grading Method |
|---|---|---|
| multiple_choice | Pick one from multiple choices | String comparison |
| output_select | Select the correct code execution output | String comparison |
| fill_in_blank | Fill in the blank | String comparison |
| code_input | Write code directly | **Pyodide** in-browser execution → stdout comparison |

**Quiz types by screen**

| Screen | beginner | intermediate | advanced |
|---|---|---|---|
| Stage lesson | multiple_choice | multiple_choice + output_select | output_select + fill_in_blank |
| Concept-check quiz | multiple_choice | fill_in_blank | fill_in_blank + output_select |
| Regular boss | multiple_choice + output_select | output_select + fill_in_blank | fill_in_blank + code_input |
| Final boss | output_select + fill_in_blank | fill_in_blank + code_input | code_input-heavy |
| Training (review) | multiple_choice + output_select | fill_in_blank + output_select | fill_in_blank + code_input |

**Training (review) composition**
- Wrong-answer review: re-serve previously missed questions from wrong_answers.json
- Repetition practice: random questions from the entire unit
- Mix of both

---

## 17. Open Questions / To Decide

- [ ] Confirm FastAPI SSE compatibility with Replit (when switching to streaming)
- [ ] Pricing for custom items
- [ ] Phase 2 mini-game direction (AI knowledge game format)
