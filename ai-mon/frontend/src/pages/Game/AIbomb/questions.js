// ═══════════════════════════════════════════════════════════════
//  questions.js — 문제 데이터, 게임 상수, 유틸
// ═══════════════════════════════════════════════════════════════

export const INITIAL_TIME  = 20;
export const PENALTY_SEC   = 10;
export const TOTAL_STAGES  = 10;

export function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export const QUESTIONS = [
  {
    "id": 1,
    "before": "",
    "after": "('Hello, Python!')",
    "answer": "print",
    "choices": ["print", "input", "type"],
    "hint": "화면에 출력하는 함수"
  },
  {
    "id": 2,
    "before": "name = ",
    "after": "('이름을 입력하세요: ')",
    "answer": "input",
    "choices": ["input", "print", "str"],
    "hint": "사용자 입력을 받는 함수"
  },
  {
    "id": 3,
    "before": "age = ",
    "after": "('25')",
    "answer": "int",
    "choices": ["int", "str", "float"],
    "hint": "문자열을 정수로 변환"
  },
  {
    "id": 4,
    "before": "result = ",
    "after": "(100)",
    "answer": "str",
    "choices": ["str", "int", "bool"],
    "hint": "숫자를 문자열로 변환"
  },
  {
    "id": 5,
    "before": "pi = ",
    "after": "('3.14')",
    "answer": "float",
    "choices": ["float", "int", "round"],
    "hint": "문자열을 실수로 변환"
  },
  {
    "id": 6,
    "before": "print(",
    "after": "(True))",
    "answer": "type",
    "choices": ["type", "str", "bool"],
    "hint": "값의 자료형을 확인하는 함수"
  },
  {
    "id": 7,
    "before": "result = 'hello'.",
    "after": "()",
    "answer": "upper",
    "choices": ["upper", "lower", "strip"],
    "hint": "문자열을 모두 대문자로 변환"
  },
  {
    "id": 8,
    "before": "result = 'PYTHON'.",
    "after": "()",
    "answer": "lower",
    "choices": ["lower", "upper", "strip"],
    "hint": "문자열을 모두 소문자로 변환"
  },
  {
    "id": 9,
    "before": "result = 'Hello World'.",
    "after": "('World', 'Python')",
    "answer": "replace",
    "choices": ["replace", "split", "find"],
    "hint": "특정 문자열을 다른 문자열로 교체"
  },
  {
    "id": 10,
    "before": "words = 'a,b,c'.",
    "after": "(',')",
    "answer": "split",
    "choices": ["split", "join", "strip"],
    "hint": "구분자로 문자열을 리스트로 분리"
  },
  {
    "id": 11,
    "before": "text = '  hello  '.",
    "after": "()",
    "answer": "strip",
    "choices": ["strip", "split", "replace"],
    "hint": "문자열 앞뒤 공백 제거"
  },
  {
    "id": 12,
    "before": "n = ",
    "after": "('Python')",
    "answer": "len",
    "choices": ["len", "count", "max"],
    "hint": "문자열의 길이를 반환하는 함수"
  },
  {
    "id": 13,
    "before": "result = 'banana'.",
    "after": "('a')",
    "answer": "count",
    "choices": ["count", "find", "index"],
    "hint": "특정 문자의 등장 횟수를 반환"
  },
  {
    "id": 14,
    "before": "",
    "after": " score >= 60:\n    print('합격')",
    "answer": "if",
    "choices": ["if", "elif", "while"],
    "hint": "조건문의 시작 키워드"
  },
  {
    "id": 15,
    "before": "if x > 0:\n    pass\n",
    "after": " x == 0:\n    pass",
    "answer": "elif",
    "choices": ["elif", "else", "if"],
    "hint": "추가 조건을 검사하는 키워드"
  },
  {
    "id": 16,
    "before": "if age >= 18 ",
    "after": " age < 65:",
    "answer": "and",
    "choices": ["and", "or", "not"],
    "hint": "두 조건이 모두 참일 때 사용"
  },
  {
    "id": 17,
    "before": "if day == 'Saturday' ",
    "after": " day == 'Sunday':",
    "answer": "or",
    "choices": ["or", "and", "not"],
    "hint": "두 조건 중 하나만 참이어도 성립"
  },
  {
    "id": 18,
    "before": "if ",
    "after": " is_logged_in:\n    print('로그인 필요')",
    "answer": "not",
    "choices": ["not", "and", "or"],
    "hint": "조건의 참/거짓을 반전"
  },
  {
    "id": 19,
    "before": "if 'python' ",
    "after": " ['java', 'python', 'c']:",
    "answer": "in",
    "choices": ["in", "not", "and"],
    "hint": "특정 값이 포함되어 있는지 확인"
  },
  {
    "id": 20,
    "before": "for i in ",
    "after": "(5):",
    "answer": "range",
    "choices": ["range", "len", "list"],
    "hint": "반복 범위를 생성하는 함수"
  },
  {
    "id": 21,
    "before": "",
    "after": " count < 10:\n    count += 1",
    "answer": "while",
    "choices": ["while", "for", "if"],
    "hint": "조건이 참인 동안 반복하는 키워드"
  },
  {
    "id": 22,
    "before": "for i in range(10):\n    if i == 5:\n        ",
    "after": "",
    "answer": "break",
    "choices": ["break", "continue", "pass"],
    "hint": "반복문을 즉시 종료하는 키워드"
  },
  {
    "id": 23,
    "before": "for i in range(10):\n    if i % 2 == 0:\n        ",
    "after": "\n    print(i)",
    "answer": "continue",
    "choices": ["continue", "break", "pass"],
    "hint": "현재 반복을 건너뛰는 키워드"
  },
  {
    "id": 24,
    "before": "for i in ",
    "after": "(1, 11, 2):",
    "answer": "range",
    "choices": ["range", "list", "zip"],
    "hint": "시작·끝·간격을 지정하는 범위 생성 함수"
  },
  {
    "id": 25,
    "before": "for i, v in ",
    "after": "(['a', 'b', 'c']):",
    "answer": "enumerate",
    "choices": ["enumerate", "zip", "range"],
    "hint": "인덱스와 값을 함께 반환하는 함수"
  },
  {
    "id": 26,
    "before": "fruits = ['apple']\nfruits.",
    "after": "('banana')",
    "answer": "append",
    "choices": ["append", "insert", "extend"],
    "hint": "리스트 끝에 요소를 추가하는 메서드"
  },
  {
    "id": 27,
    "before": "nums = [1, 2, 3]\nlast = nums.",
    "after": "()",
    "answer": "pop",
    "choices": ["pop", "remove", "clear"],
    "hint": "리스트 마지막 요소를 꺼내는 메서드"
  },
  {
    "id": 28,
    "before": "items = [1, 2, 3, 2]\nitems.",
    "after": "(2)",
    "answer": "remove",
    "choices": ["remove", "pop", "clear"],
    "hint": "첫 번째로 일치하는 값을 제거하는 메서드"
  },
  {
    "id": 29,
    "before": "nums = [3, 1, 4, 1, 5]\nnums.",
    "after": "()",
    "answer": "sort",
    "choices": ["sort", "reverse", "clear"],
    "hint": "리스트를 오름차순으로 정렬하는 메서드"
  },
  {
    "id": 30,
    "before": "fruits = ['apple', 'banana', 'cherry']\nn = ",
    "after": "(fruits)",
    "answer": "len",
    "choices": ["len", "count", "max"],
    "hint": "리스트의 요소 개수를 반환하는 함수"
  },
  {
    "id": 31,
    "before": "with ",
    "after": "('data.txt', 'r') as f:",
    "answer": "open",
    "choices": ["open", "read", "file"],
    "hint": "파일을 여는 내장 함수"
  },
  {
    "id": 32,
    "before": "",
    "after": " add(a, b):\n    return a + b",
    "answer": "def",
    "choices": ["def", "class", "return"],
    "hint": "함수를 정의하는 키워드"
  },
  {
    "id": 33,
    "before": "def multiply(a, b):\n    ",
    "after": " a * b",
    "answer": "return",
    "choices": ["return", "print", "yield"],
    "hint": "함수의 결과값을 반환하는 키워드"
  },
  {
    "id": 34,
    "before": "result = ",
    "after": "(3.14159, 2)",
    "answer": "round",
    "choices": ["round", "int", "float"],
    "hint": "소수점 자리수를 반올림하는 함수"
  },
  {
    "id": 35,
    "before": "count = 0\ndef increment():\n    ",
    "after": " count\n    count += 1",
    "answer": "global",
    "choices": ["global", "nonlocal", "return"],
    "hint": "함수 내에서 전역 변수 사용을 선언하는 키워드"
  },
  {
    "id": 36,
    "before": "total = ",
    "after": "([1, 2, 3, 4, 5])",
    "answer": "sum",
    "choices": ["sum", "max", "len"],
    "hint": "리스트 요소의 합계를 반환하는 함수"
  },
  {
    "id": 37,
    "before": "d = {'a': 1, 'b': 2}\nfor k in d.",
    "after": "():",
    "answer": "keys",
    "choices": ["keys", "values", "items"],
    "hint": "딕셔너리의 모든 키를 반환하는 메서드"
  },
  {
    "id": 38,
    "before": "d = {'name': 'Amy'}\nresult = d.",
    "after": "('age', 0)",
    "answer": "get",
    "choices": ["get", "pop", "keys"],
    "hint": "키가 없을 때 기본값을 반환하는 딕셔너리 메서드"
  },
  {
    "id": 39,
    "before": "unique = ",
    "after": "([1, 2, 2, 3, 3])",
    "answer": "set",
    "choices": ["set", "list", "tuple"],
    "hint": "중복을 제거한 집합을 만드는 함수"
  },
  {
    "id": 40,
    "before": "a = {1, 2, 3}\nb = {3, 4, 5}\nresult = a.",
    "after": "(b)",
    "answer": "union",
    "choices": ["union", "intersection", "difference"],
    "hint": "두 집합의 합집합을 반환하는 메서드"
  },
  {
    "id": 41,
    "before": "",
    "after": ":\n    result = int('abc')",
    "answer": "try",
    "choices": ["try", "except", "finally"],
    "hint": "예외가 발생할 수 있는 코드 블록 키워드"
  },
  {
    "id": 42,
    "before": "try:\n    x = int('abc')\n",
    "after": " ValueError:\n    print('오류 발생')",
    "answer": "except",
    "choices": ["except", "else", "finally"],
    "hint": "특정 예외를 처리하는 블록 키워드"
  },
  {
    "id": 43,
    "before": "try:\n    pass\nexcept:\n    pass\n",
    "after": ":\n    print('항상 실행')",
    "answer": "finally",
    "choices": ["finally", "else", "except"],
    "hint": "예외 여부와 무관하게 항상 실행되는 블록"
  },
  {
    "id": 44,
    "before": "if age < 0:\n    ",
    "after": " ValueError('나이는 음수일 수 없습니다')",
    "answer": "raise",
    "choices": ["raise", "return", "print"],
    "hint": "직접 예외를 발생시키는 키워드"
  },
  {
    "id": 45,
    "before": "coords = ",
    "after": "([3, 5])",
    "answer": "tuple",
    "choices": ["tuple", "list", "set"],
    "hint": "리스트를 변경 불가능한 튜플로 변환"
  },
  {
    "id": 46,
    "before": "result = ",
    "after": "((1, 2, 3), tuple)",
    "answer": "isinstance",
    "choices": ["isinstance", "type", "issubclass"],
    "hint": "특정 자료형의 인스턴스인지 확인하는 함수"
  },
  {
    "id": 47,
    "before": "a, ",
    "after": "rest = [1, 2, 3, 4]",
    "answer": "*",
    "choices": ["*", "**", "&"],
    "hint": "나머지 값을 하나의 리스트로 묶는 언패킹 연산자"
  },
  {
    "id": 48,
    "before": "square = ",
    "after": " x: x ** 2",
    "answer": "lambda",
    "choices": ["lambda", "def", "return"],
    "hint": "이름 없는 익명 함수를 만드는 키워드"
  },
  {
    "id": 49,
    "before": "nums = [1, 2, 3]\nresult = list(",
    "after": "(str, nums))",
    "answer": "map",
    "choices": ["map", "filter", "zip"],
    "hint": "모든 요소에 함수를 적용하는 고차 함수"
  },
  {
    "id": 50,
    "before": "nums = [1, 2, 3, 4, 5]\nresult = list(",
    "after": "(lambda x: x % 2 == 0, nums))",
    "answer": "filter",
    "choices": ["filter", "map", "sorted"],
    "hint": "조건을 만족하는 요소만 걸러내는 고차 함수"
  },
  {
    "id": 51,
    "before": "def func(",
    "after": "args):\n    print(args)",
    "answer": "*",
    "choices": ["*", "**", "&"],
    "hint": "가변 위치 인수를 받는 연산자"
  },
  {
    "id": 52,
    "before": "def func(",
    "after": "kwargs):\n    print(kwargs)",
    "answer": "**",
    "choices": ["**", "*", "&"],
    "hint": "가변 키워드 인수를 받는 연산자"
  },
  {
    "id": 53,
    "before": "",
    "after": " Dog:\n    pass",
    "answer": "class",
    "choices": ["class", "def", "object"],
    "hint": "클래스를 정의하는 키워드"
  },
  {
    "id": 54,
    "before": "class Cat:\n    def ",
    "after": "(self, name):\n        self.name = name",
    "answer": "__init__",
    "choices": ["__init__", "__str__", "__new__"],
    "hint": "객체 생성 시 자동으로 호출되는 초기화 메서드"
  },
  {
    "id": 55,
    "before": "class Dog:\n    def bark(",
    "after": "):\n        print('Woof!')",
    "answer": "self",
    "choices": ["self", "cls", "this"],
    "hint": "인스턴스 자신을 가리키는 첫 번째 매개변수"
  },
  {
    "id": 56,
    "before": "class Puppy(Dog):\n    def __init__(self, name):\n        ",
    "after": "().__init__(name)",
    "answer": "super",
    "choices": ["super", "self", "cls"],
    "hint": "부모 클래스를 참조하는 함수"
  },
  {
    "id": 57,
    "before": "class Person:\n    def ",
    "after": "(self):\n        return f'Person({self.name})'",
    "answer": "__str__",
    "choices": ["__str__", "__repr__", "__init__"],
    "hint": "print() 호출 시 반환되는 문자열 표현 메서드"
  },
  {
    "id": 58,
    "before": "squares = [x**2 ",
    "after": " x in range(10)]",
    "answer": "for",
    "choices": ["for", "if", "while"],
    "hint": "리스트 컴프리헨션의 반복 키워드"
  },
  {
    "id": 59,
    "before": "import json\ndata = json.",
    "after": "('[1, 2, 3]')",
    "answer": "loads",
    "choices": ["loads", "load", "dumps"],
    "hint": "JSON 문자열을 파이썬 객체로 변환"
  },
  {
    "id": 60,
    "before": "import json\ntext = json.",
    "after": "({'name': 'Amy'})",
    "answer": "dumps",
    "choices": ["dumps", "loads", "dump"],
    "hint": "파이썬 객체를 JSON 문자열로 변환"
  }
]
