import os

# 1. Update backend/routers/quiz.py
quiz_py_path = r"c:\AIMON\AIMON1\ai-mon\backend\routers\quiz.py"
with open(quiz_py_path, "r", encoding="utf-8") as f:
    content = f.read()

old_serialize = """def serialize_question(q: dict) -> dict:
    \"\"\"클라 응답용 문제 직렬화 — 민감 필드 제거(F 방어).

    렌더에 필요한 choices/options/code/type/quiz_set 등은 모두 유지(denylist 방식).
    quiz·miniboss·unitboss·endboss 의 모든 '문제 서빙' 응답이 이 헬퍼를 거쳐야 한다.
    \"\"\"
    if not isinstance(q, dict):
        return q
    return {k: v for k, v in q.items() if k not in _SENSITIVE_QUESTION_FIELDS}"""

new_serialize = """def serialize_question(q: dict) -> dict:
    \"\"\"클라 응답용 문제 직렬화 — 민감 필드 제거(F 방어).

    렌더에 필요한 choices/options/code/type/quiz_set 등은 모두 유지(denylist 방식).
    quiz·miniboss·unitboss·endboss 의 모든 '문제 서빙' 응답이 이 헬퍼를 거쳐야 한다.
    \"\"\"
    if not isinstance(q, dict):
        return q
        
    # code_input 유형인 경우, 정답이 제거되기 전에 보기를 섞어서 제공합니다.
    q_type = q.get("type") or q.get("quiz_type")
    if q_type == "code_input":
        import random
        correct_answer = q.get("answer") or ""
        fallbacks = [
            '__init__', '__str__', 'super()', 'yield', 'next()', 
            '__enter__', '__exit__', 'wraps', 'decorator', 'wrapper',
            'True', 'False', 'None', 'args', 'kwargs', 'lambda'
        ]
        distractors = [f for f in fallbacks if f != correct_answer]
        random.shuffle(distractors)
        pool = [correct_answer] + distractors[:4]
        random.shuffle(pool)
        
        q_copy = dict(q)
        q_copy["word_bank"] = pool
        return {k: v for k, v in q_copy.items() if k not in _SENSITIVE_QUESTION_FIELDS}
        
    return {k: v for k, v in q.items() if k not in _SENSITIVE_QUESTION_FIELDS}"""

if old_serialize in content:
    content = content.replace(old_serialize, new_serialize)
else:
    content = content.replace(old_serialize.replace("\n", "\r\n"), new_serialize.replace("\n", "\r\n"))

with open(quiz_py_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated quiz.py")


# 2. Update frontend files
front_files = [
    r"c:\AIMON\AIMON1\ai-mon\frontend\src\components\QuizCard\QuizCard.jsx",
    r"c:\AIMON\AIMON1\ai-mon\frontend\src\pages\Boss\BossBattle.jsx",
    r"c:\AIMON\AIMON1\ai-mon\frontend\src\pages\EndBoss\EndBossBattle.jsx"
]

for fpath in front_files:
    with open(fpath, "r", encoding="utf-8") as f:
        f_content = f.read()

    # We will change the useMemo wordBank hook to use question.word_bank if available.
    # In QuizCard.jsx:
    # const wordBank = useMemo(() => { ... }, [question, questions, isCodeInput])
    # In Boss/EndBoss:
    # const wordBank = useMemo(() => { ... }, [currentQuestion])

    old_wb_block = """  const wordBank = useMemo(() => {
    if (!question || !isCodeInput) return []
    const correctAnswer = question.answer || ''
    
    let otherAnswers = (questions || [])
      .map(q => q.answer)
      .filter(ans => ans && ans !== correctAnswer)
      
    if (otherAnswers.length < 4) {
      const fallbacks = [
        '__init__', '__str__', 'super()', 'yield', 'next()', 
        '__enter__', '__exit__', 'wraps', 'decorator', 'wrapper',
        'True', 'False', 'None', 'args', 'kwargs', 'lambda'
      ].filter(f => f !== correctAnswer)
      otherAnswers = [...otherAnswers, ...fallbacks]
    }
    
    const uniqueOthers = [...new Set(otherAnswers)]
    const distractors = uniqueOthers.sort(() => 0.5 - Math.random()).slice(0, 4)
    
    const pool = [correctAnswer, ...distractors]
    return pool.sort(() => 0.5 - Math.random())
  }, [question, questions, isCodeInput])"""

    new_wb_block = """  const wordBank = useMemo(() => {
    if (!question || !isCodeInput) return []
    if (question.word_bank && question.word_bank.length > 0) {
      return question.word_bank
    }
    const correctAnswer = question.answer || ''
    
    let otherAnswers = (questions || [])
      .map(q => q.answer)
      .filter(ans => ans && ans !== correctAnswer)
      
    if (otherAnswers.length < 4) {
      const fallbacks = [
        '__init__', '__str__', 'super()', 'yield', 'next()', 
        '__enter__', '__exit__', 'wraps', 'decorator', 'wrapper',
        'True', 'False', 'None', 'args', 'kwargs', 'lambda'
      ].filter(f => f !== correctAnswer)
      otherAnswers = [...otherAnswers, ...fallbacks]
    }
    
    const uniqueOthers = [...new Set(otherAnswers)]
    const distractors = uniqueOthers.sort(() => 0.5 - Math.random()).slice(0, 4)
    
    const pool = [correctAnswer, ...distractors]
    return pool.sort(() => 0.5 - Math.random())
  }, [question, questions, isCodeInput])"""

    # For BossBattle and EndBossBattle
    old_wb_boss = """  const wordBank = useMemo(() => {
    if (!currentQuestion || currentQuestion.type !== 'code_input') return []
    const correctAnswer = currentQuestion.answer || ''
    const fallbacks = [
      '__init__', '__str__', 'super()', 'yield', 'next()', 
      '__enter__', '__exit__', 'wraps', 'decorator', 'wrapper',
      'True', 'False', 'None', 'args', 'kwargs', 'lambda'
    ].filter(f => f !== correctAnswer)
    const distractors = fallbacks.sort(() => 0.5 - Math.random()).slice(0, 4)
    const pool = [correctAnswer, ...distractors]
    return pool.sort(() => 0.5 - Math.random())
  }, [currentQuestion])"""

    new_wb_boss = """  const wordBank = useMemo(() => {
    if (!currentQuestion || currentQuestion.type !== 'code_input') return []
    if (currentQuestion.word_bank && currentQuestion.word_bank.length > 0) {
      return currentQuestion.word_bank
    }
    const correctAnswer = currentQuestion.answer || ''
    const fallbacks = [
      '__init__', '__str__', 'super()', 'yield', 'next()', 
      '__enter__', '__exit__', 'wraps', 'decorator', 'wrapper',
      'True', 'False', 'None', 'args', 'kwargs', 'lambda'
    ].filter(f => f !== correctAnswer)
    const distractors = fallbacks.sort(() => 0.5 - Math.random()).slice(0, 4)
    const pool = [correctAnswer, ...distractors]
    return pool.sort(() => 0.5 - Math.random())
  }, [currentQuestion])"""

    if old_wb_block in f_content:
        f_content = f_content.replace(old_wb_block, new_wb_block)
    elif old_wb_block.replace("\n", "\r\n") in f_content:
        f_content = f_content.replace(old_wb_block.replace("\n", "\r\n"), new_wb_block.replace("\n", "\r\n"))
    elif old_wb_boss in f_content:
        f_content = f_content.replace(old_wb_boss, new_wb_boss)
    elif old_wb_boss.replace("\n", "\r\n") in f_content:
        f_content = f_content.replace(old_wb_boss.replace("\n", "\r\n"), new_wb_boss.replace("\n", "\r\n"))

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(f_content)
    print(f"Updated {os.path.basename(fpath)}")
