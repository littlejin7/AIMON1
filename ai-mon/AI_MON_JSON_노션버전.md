# AI MON JSON 구조 (노션 기준)

---

### questions.json
```json
{
  "questions": [
    {
      "question_id": "q001",
      "unit": 1,
      "stage": "1-1",
      "level": "beginner",
      "type": "multiple_choice",
      "question": "print()의 역할은 무엇인가요?",
      "choices": ["A. 값을 저장한다", "B. 값을 출력한다", "C. 값을 삭제한다", "D. 값을 계산한다"],
      "answer": "B",
      "explanation": "print()는 괄호 안의 값을 화면에 출력하는 함수입니다."
    },
    {
      "question_id": "q002",
      "unit": 1,
      "stage": "1-2",
      "level": "beginner",
      "type": "code_input",
      "question": "변수 name에 '에이몬'을 저장하는 코드를 작성하세요.",
      "choices": null,
      "answer": "name = '에이몬'",
      "explanation": "변수는 = 기호로 값을 저장합니다."
    }
  ]
}
```

---

### users.json
```json
{
  "user_id": "u001",
  "nickname": "지니",
  "level": "beginner",
  "xp": 320,
  "crowns": 5,
  "streak": 3,
  "last_login": "2026-06-02",
  "avatar_stage": "beginner",
  "created_at": "2026-06-01"
}
```

---

### progress.json
```json
{
  "user_id": "u001",
  "level": "beginner",
  "final_boss": {
    "status": "locked",
    "attempts": 0
  },
  "units": [
    {
      "unit": 1,
      "status": "completed",
      "stages": [
        { "stage": "1-1", "status": "completed", "score": 100, "attempts": 1, "completed_at": "2026-06-01" }
      ],
      "boss": {
        "status": "completed",
        "attempts": 1,
        "boss_attempts_today": 1,
        "last_attempt_date": "2026-06-01",
        "hints_used": 0
      },
      "training": { "status": "completed", "score": 90, "attempts": 1 }
    }
  ]
}
```

---

### wrong_answers.json
```json
{
  "user_id": "u001",
  "wrong_answers": [
    {
      "question_id": "q001",
      "unit": 1,
      "stage": "1-1",
      "level": "beginner",
      "type": "multiple_choice",
      "question": "print()의 역할은?",
      "choices": ["A", "B", "C", "D"],
      "user_answer": "B",
      "correct_answer": "A",
      "ai_explanation": "...",
      "wrong_count": 2,
      "reviewed": false,
      "last_wrong_at": "2026-06-02",
      "created_at": "2026-06-01"
    }
  ]
}
```
