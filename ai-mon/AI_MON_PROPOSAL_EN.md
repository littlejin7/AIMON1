---
notion_page: https://app.notion.com/p/AI-MON-_-334ea473fb45804c878ee39b49a1c36a
title: AI MON PROPOSAL (EN)
---
# 🤖 AI MON — AI-Mon
# AI Coding Learning Platform Proposal | v1.0 | 2026

---

## 1. Service Overview

AI-Mon is a PWA (Progressive Web App) designed for non-developers, making it fun to learn coding from Python basics all the way to building AI agents — like playing a game.

### 2. Brand Story

- **Hidden Ally:** Just like Amon, the mysterious ancient Egyptian deity, AI-Mon is a powerful companion that helps even non-developers unlock and master complex AI technology.
- **Creature-Raising Game:** For non-developers, coding isn't boring study — it's a game where you raise your own AI character, AI-Mon. Users earn XP every day by solving Duolingo-style Python quizzes, and AI-Mon evolves each time a unit is completed. Clear all of Unit 8 and you'll finally meet AI-Mon's ultimate form.

### 3. Core Target

- **Complete beginners and adult newcomers** who want to build their own AI agent but are too intimidated to start because they have zero coding experience

---

## 2. Service Universe

> AI-Mon users don't just solve problems.
> They become **developers who grow by defeating bosses**.

### 2-1. Core Structure

Users study units, and a **Boss** appears at the end of each one. Defeating the boss grows the character, generates a certification card, and adds an entry to the portfolio.

```
Take lesson → Solve concept questions → Unit boss appears → Boss clear
                                                                ↓
                                   Cert card auto-generated + XP earned + portfolio entry
```

### 2-2. Character Growth & Customization

- **XP System:** Earn XP from activities → level up + buy custom items
  - Stage quiz clear: 500 XP
  - Boss clear: 2,000 XP
  - Training complete: 1,000 XP
  - Streak reward: 500 – 10,000 XP
- **Level Range:** Lv 1–40 (more XP required per level at higher levels, MapleStory-style)
- **Character Evolution:** triggered by **unit completion**, not XP
  - Unit 3 complete → slime → robot
  - Unit 6 complete → robot → speech_bubble
  - Unit 8 complete → speech_bubble → final_ghost
- Use earned XP (coins) to **change character color palette & effects**
- **Terminal themes** (color scheme, font, prompt style) provided as unlockables

### 2-3. Hint Coin System

- Use hint coins during a Boss challenge → **view 1 AI hint** (max 2 per boss)
- No hints on the Final Boss
- Coins earned through learning activities (attendance · code review · community contribution)
- Anti-paywall messaging: free earning paths always displayed at the top of the UI

### 2-4. Certification & Honor Rewards

**A certification card is auto-generated on every Boss clear:**
- Includes character image + nickname · boss name · clear time · language used · date
- PNG download + public share link → instantly post to Instagram · X · LinkedIn
- **Viral loop:** share cert card → new users arrive → they challenge boss → share again

**Hall of Fame:**
- Default view is "me vs. past me" growth timeline (global ranking is opt-in)
- Personal growth metrics are front-and-center to prevent beginner drop-off

### 2-5. GitHub Integration & Portfolio (High-Difficulty Rewards)

- **GitHub Badge:** SVG file auto-generated → embed code for GitHub README.md provided instantly
- **Portfolio Dashboard:** cleared code and architecture are auto-registered as project cards
  - Card: project overview · tech stack used · code highlights · clear time
  - Share your entire portfolio with recruiters via a single public URL

> **Differentiator:** Among major competitors (LeetCode · Codewars · Codecademy), no platform currently offers both auto-generated portfolios and direct GitHub badge issuance simultaneously.

### 2-6. Final Boss System

The highest-difficulty content, unlocked post-commercialization. Goes beyond simple coding problems to comprehensively evaluate **design ability + AI utilization skills**.

- Clear reward: **personalized certification card (high-quality artwork)** generated via AI image creation
- "Final Boss Cleared" special banner auto-registered in the portfolio dashboard
- Entry into a dedicated Hall of Fame section + permanent badge granted
- **Clearing this level = an instantly verifiable credential for the job market**

### 2-7. Reward Type Summary

| Reward Type | Trigger | User Value |
|---|---|---|
| XP | Boss clear | Custom item purchases · sense of ownership · long-term engagement |
| Character evolution | Unit 3 · 6 · 8 complete | Visual AI-Mon growth · immersion |
| Crown (coin) | All learning activities | Appearance customization · hint purchases |
| Terminal theme | Specific boss achievement | Practical reward that applies to a real dev environment |
| Cert card | Immediately on boss clear | SNS sharing → organic marketing · sense of achievement |
| Hall of Fame | On ranking entry | Competitive motivation · community building |
| GitHub badge | High-difficulty boss clear | GitHub README decoration · recruiter appeal |
| Portfolio card | High-difficulty boss clear | Auto code registration · recruiter share link |

---

## 3. Service Structure

AI-Mon has 3 categories at MVP, expanding to 4 categories from Phase 2.

```
📚 Lesson
  └ Units 1–8
      ├ Stage 1-1
      │   ├ Briefing (concept slides + terminal + tip)
      │   └ Quiz → villain appears
      └ Boss → final stage

🔄 Training (unlocks after unit clear)
  └ Wrong-answer review + full unit repeat practice

🎮 Mini-game (post-MVP)
  ├ Game A: casual time-killer (Anipang-style) → earn crowns
  └ Game B: AI knowledge game (card battle / O-X quiz etc.) → earn 100–300 XP (varies by difficulty)

🧑 My Character
  └ AI-Mon evolution status · customization
```

---

## 4. Core Features

### 📚 Lesson

- **Concept learning:** unit-specific concept explanations + examples
- **Concept-check quizzes:** appear mid-lesson · presented alongside villain characters
- **Unit quiz:** multi-topic questions covering the full unit (multiple_choice + code_input)
- **Boss battle:** final stage of unit quiz · clears award XP + auto-generate cert card
- Wrong answers get **explanation from Claude AI on why it was wrong** → key differentiator
- In-browser Python execution: **Pyodide** (WASM-based, no server required)

### 🔄 Training

- Quiz sets covering the full unit
- **Wrong-answer note auto-curation** focused on previously missed questions
- **Streak** system — +1 on daily login, resets to 0 if a day is missed
- Automatic XP + crown grant on streak milestones (3 days 500XP / 7 days 2,000XP+1 crown / 14 days 5,000XP+2 crowns / 30 days 10,000XP+5 crowns)

### 🧑 My Character

- View **AI-Mon evolution status** as units progress
- Use earned coins to customize character color & effects
- Terminal theme unlock (post-MVP)

---

## 5. Curriculum

> **8 units / 51 lessons** total. From Python basics to building AI agents.

### Unit Overview

| Unit | Topic | Lessons | Core Concepts |
|---|---|---|---|
| **Unit 1** | Output & Variables & Data Types | 7 | print, variable declaration, int / str / float / bool |
| **Unit 2** | Lists & Dictionaries | 7 | list, dict, indexing, iteration |
| **Unit 3** | Conditionals & Logic | 5 | if / elif / else, and / or / not |
| **Unit 4** | Loops | 5 | for, while, break / continue |
| **Unit 5** | Functions | 6 | def, parameters, return, scope |
| **Unit 6** | String Processing & Libraries | 6 | str methods, import, random / datetime |
| **Unit 7** | Files & JSON & API Basics | 6 | json, requests, API calls, prompt engineering |
| **Unit 8** | Building AI Agents | 9 | Tool Use, agent loop, automation design |

---

## 6. Character Design

### 🟣 Protagonist — AI-Mon (evolves as units progress)

| Stage | Applied Range | Appearance |
|---|---|---|
| **slime** | Units 1–3 | Chubby purple slime · crown · `</>` badge |
| **robot** | Units 4–6 | Purple robot with headphones · crown · more 3D |
| **speech_bubble** | Units 7–8 | Speech bubble body · white face panel · `{}` + `</>` |
| **final_ghost** | All units cleared | Translucent light-purple ghost · `AI` badge · premium feel |

### 🖤 Boss Character

- Same form as AI-Mon · **dark/black color scheme**
- Appears at the final stage of each unit quiz
- Clear awards XP + auto-generates cert card

### 😈 3 Villain Types

| Name | Color | Role | Assigned Units |
|---|---|---|---|
| **Code-mon** | Purple | A villain that tangles conversations with nonsensical code | Units 1 · 2 |
| **Bubble King** | Pink | A villain that hides conversations behind endless speech bubbles | Units 3 · 4 · 5 |
| **Jammer-mon** | Mint | A villain that obstructs accurate answers by hiding AI information | Units 6 · 7 · 8 |

---

## 7. Team Composition & Roles

**Team name:** AI-Jjang

| Name | Role | Responsibilities |
|---|---|---|
| Ji Hyewon (Lead) | UI Dev + Integration Lead | Front-end UI · collecting each member's work · final assembly |
| Yi Wangi | UI Dev | Front-end UI · component development |
| Haeryang | QA + Content | UX review · curriculum design · question data creation |
| Jihun | QA + Content | UX review · curriculum design · question data creation |

---

## 8. Tech Stack

| Part | Technology | Notes |
|---|---|---|
| Front-end (PWA) | React + Vite | Using the class tech stack as-is |
| Back-end | FastAPI (Python) | AI API integration + REST endpoints |
| AI Engine | Claude + Gemini | Question generation · hints · code evaluation |
| Code Execution | **Pyodide** (WASM) | No server required; runs directly in the browser |
| IDE | Google Antigravity | Scaffold generation via AI Agent |
| Collaboration/Runtime | Replit | Team execution testing |
| Version Control | GitHub | Full framework management |
| DB | SQLite → PostgreSQL | Development → deployment |
| Auth | JWT | — |

---

## 9. MVP Scope

> Feature-cut to what can be submitted within the deadline.

**✅ MVP Required (nail these perfectly)**
- Guest users see /level-test-info page → prompted to sign up
- Level test available only to logged-in users; level badge shown on dashboard
- Stage quiz solving (multiple_choice / output_select / fill_in_blank / code_input)
- Correct answer: output `explanation` field text (no API call)
- Wrong answer: Claude AI feedback explanation (varies by level) → **key differentiator**
- Progress tracking (progress.json)
- XP + level-up (Lv 1–40)
- Basic crown earn/spend logic
- Boss challenge (2 free attempts per day, then crown cost)
- Character evolution (on Unit 3 / 6 / 8 complete)

**⬜ Later (post-MVP)**
- Training (review) system · wrong-answer notes
- Cert card · portfolio auto-completion
- Streak rewards · custom items
- Final Boss
- Mini-game category (nav bar expands to 4 tabs)
  - Game A: casual time-killer (Anipang-style) → earn crowns
  - Game B: AI knowledge game (card battle / O-X quiz, 2–3 types) → earn 100–300 XP (by difficulty)
- Leaderboard · friends feature · community
- GitHub badge integration

---

## 10. Development Roadmap (Full Service)

| Phase | Content |
|---|---|
| **Phase 1 MVP** | Boss clear system · cert card generation & sharing · Hall of Fame ranking |
| **Phase 2** | Character evolution & customization · terminal custom themes · hint coin system |
| **Phase 3** | GitHub badge integration · portfolio auto-completion · GitHub README SVG issuance |
| **Final Boss** | AI image generation reward · highest-difficulty boss unlock · recruiter portfolio link |

---

## 11. Prototype Schedule (June 1–8)

> 🎯 Goal: **First prototype complete by Sunday, June 8**

| Date | Milestone | Key Tasks |
|---|---|---|
| 6/1 (Mon) | Kickoff | Finalize roles · create GitHub repo · start curriculum research |
| 6/2 (Tue) | Scaffold | Generate full framework with Antigravity → confirm Replit runs → GitHub push |
| 6/4 (Thu) | UI dev starts | Main layout · quiz screen · 10 question data entries |
| 6/5 (Fri) | Core feature dev | Progress tracking + FastAPI connection · XP/level logic · 20+ question data entries |
| 6/8 (Mon) | AI hint integration | Claude API hint feature · wrong-answer explanation output · UX testing |
| 6/9 (Tue) | Integration + final review | PR merge · full assembly · PWA config · final Replit deploy |

---

## 12. Core Design Principles

1. **Link skill to reward** — appearance customization is a personal preference; GitHub badges & portfolios are granted only as proof of skill
2. **Beginner-friendly** — Hall of Fame default view is personal growth graph; global ranking is opt-in
3. **Prevent paywall misconceptions** — free hint coin earning paths always displayed at top of UI
4. **Viral loop** — share cert card → new users arrive → boss challenge → share again

---

> ⚠️ **Security notice:** Never push API keys to GitHub → `.env` + `.gitignore` required
