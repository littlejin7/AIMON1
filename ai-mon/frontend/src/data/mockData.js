export const MOCK_BRIEFINGS = {
  '1-1': [
    {
      id: 1,
      title: '파이썬 첫걸음: 변수와 출력',
      text: '파이썬에서 **변수**는 데이터를 담아두는 "이름표 붙인 상자"와 같습니다.\n`=` 기호를 사용해서 상자 안에 값을 넣을 수 있어요.',
      code: 'x = 42\nname = "에이몬"',
      tip: '주의: 파이썬에서 `=`는 "같다"는 뜻이 아니라, "오른쪽 값을 왼쪽에 넣는다(대입)"는 뜻이에요!'
    },
    {
      id: 2,
      title: '화면에 값 보여주기',
      text: '상자(변수) 안에 든 값을 확인하려면 `print()` 함수를 사용합니다.\n괄호 안에 보고 싶은 변수나 값을 넣으면 콘솔 화면에 출력됩니다.',
      code: 'print(x)\n# 출력 결과: 42\n\nprint("안녕하세요!")\n# 출력 결과: 안녕하세요!',
      tip: '`print()`는 프로그래밍할 때 값이 맞게 들어갔는지 확인하는 가장 기본적이고 중요한 도구랍니다.'
    }
  ]
}

export const MOCK_QUESTIONS = [
  {
    "id": "q-l01-s1-01",
    "lesson_id": "1",
    "stage": 1,
    "type": "multiple_choice",
    "question": "파이썬에서 숫자 42를 변수 x에 저장하는 올바른 코드는?",
    "options": ["x == 42", "x = 42", "x := 42", "int x = 42"],
    "answer": "x = 42",
    "explanation": "파이썬은 = 기호로 변수에 값을 대입합니다."
  },
  {
    "id": "q-l01-s1-02",
    "lesson_id": "1",
    "stage": 1,
    "type": "multiple_choice",
    "question": "print() 함수는 어떤 역할을 하나요?",
    "options": ["값을 저장한다", "화면에 출력한다", "숫자를 계산한다", "파일을 읽는다"],
    "answer": "화면에 출력한다",
    "explanation": "print()는 소괄호 안의 내용을 화면(콘솔)에 출력합니다."
  }
]
