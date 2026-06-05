// ──────────────────────────────────────────────────────────
// 스키마 기준: lesson_id, unit, stage, course_level, villain, slides[]
// 실제 데이터: backend/data/lessons/lessons_1_1.json 참조
// 이 목 데이터는 API 없이 로컬 개발·테스트 시 사용
// ──────────────────────────────────────────────────────────

export const MOCK_LESSONS = [
  {
    lesson_id: '1-1-beginner',
    unit: 1,
    stage: '1-1',
    course_level: 'beginner',
    title: 'Hello, Python!',
    villain: 'codemmon',
    slides: [
      {
        order: 1,
        text: 'Python에서 화면에 글자를 보여주려면 print()를 사용해요.\n마치 스피커처럼, 괄호 안에 넣은 내용을 소리 내어 출력해줘요.\n글자는 반드시 따옴표(\' \')로 감싸야 해요.',
        terminal: {
          code: ["print('안녕, 에이몬!')"],
          output: ['안녕, 에이몬!']
        },
        tip: "따옴표는 Python에게 '이건 글자야!'라고 알려주는 신호예요. 출력 결과엔 따옴표가 나타나지 않아요."
      },
      {
        order: 2,
        text: 'print()를 두 번 쓰면 두 줄이 출력돼요.\nprint()는 한 번 실행될 때마다 자동으로 줄을 바꿔줘요.\n한 줄씩 차례대로 실행된다는 것도 기억해두세요!',
        terminal: {
          code: ["print('첫 번째 줄')", "print('두 번째 줄')"],
          output: ['첫 번째 줄', '두 번째 줄']
        },
        tip: '코드는 위에서 아래로 한 줄씩 순서대로 실행돼요.'
      },
      {
        order: 3,
        text: "코드 앞에 # 기호를 붙이면 그 줄은 실행되지 않아요.\n이걸 '주석'이라고 해요.\n코드에 메모를 남기거나, 잠깐 코드를 꺼두고 싶을 때 유용해요.",
        terminal: {
          code: ["print('이건 실행돼요')", "# print('이건 실행 안 돼요')", "print('이것도 실행돼요')"],
          output: ['이건 실행돼요', '이것도 실행돼요']
        },
        tip: '# 이 붙은 줄은 Python이 완전히 무시해요. 주석은 실행 결과에 영향을 주지 않아요.'
      }
    ]
  }
]

// ──────────────────────────────────────────────────────────
// 퀴즈 목 데이터 — 스키마: question_id, unit, stage, course_level
// ──────────────────────────────────────────────────────────

export const MOCK_QUESTIONS = [
  {
    question_id: 'sl_beg_mc_1_1_001',
    unit: 1,
    stage: '1-1',
    course_level: 'beginner',
    type: 'multiple_choice',
    question: 'print()의 역할은 무엇인가요?',
    choices: ['A. 값을 저장한다', 'B. 값을 출력한다', 'C. 값을 삭제한다', 'D. 값을 계산한다'],
    answer: 'B',
    explanation: 'print()는 괄호 안의 값을 화면에 출력하는 함수예요.'
  },
  {
    question_id: 'sl_beg_mc_1_1_002',
    unit: 1,
    stage: '1-1',
    course_level: 'beginner',
    type: 'multiple_choice',
    question: 'Python에서 주석을 작성할 때 사용하는 기호는?',
    choices: ['A. //', 'B. --', 'C. #', 'D. /*'],
    answer: 'C',
    explanation: '# 뒤에 오는 내용은 Python이 무시해요.'
  }
]
