// OX 퀴즈 데이터
export const OX_QUESTIONS = [
  {
    "q": "함수는 return문을 사용하여 결과값을 호출한 곳으로 반환할 수 있다.",
    "answer": true
  },
  {
    "q": "elif는 여러 조건을 순차적으로 검사할 때 사용한다.",
    "answer": true
  },
  {
    "q": "in 연산자를 사용하면 특정 값이 리스트나 문자열에 포함되어 있는지 확인할 수 있다.",
    "answer": true
  },
  {
    "q": "len() 함수를 사용하면 문자열의 길이를 구할 수 있다.",
    "answer": true
  },
  {
    "q": "함수의 매개변수에는 기본값을 지정할 수 있다.",
    "answer": true
  },
  {
    "q": "클래스 이름과 인스턴스 이름은 반드시 동일해야 한다.",
    "answer": false
  },
  {
    "q": "리스트는 서로 다른 자료형의 값을 함께 담을 수 있다.",
    "answer": true
  },
  {
    "q": "문자열은 + 연산자를 사용하여 서로 연결할 수 있다.",
    "answer": true
  },
  {
    "q": "finally 블록은 예외가 발생하지 않았을 때만 실행된다.",
    "answer": false
  },
  {
    "q": "딕셔너리는 숫자 인덱스를 사용하여 값을 조회한다.",
    "answer": false
  },
  {
    "q": "요소가 하나뿐인 튜플을 만들 때는 (1,)처럼 쉼표를 붙여야 한다.",
    "answer": true
  },
  {
    "q": "딕셔너리에 존재하지 않는 key로 값을 조회하면 자동으로 None이 반환되며 오류는 발생하지 않는다.",
    "answer": false
  },
  {
    "q": "0은 파이썬에서 항상 True로 평가되는 값이다.",
    "answer": false
  },
  {
    "q": "한 클래스 안에는 메서드를 단 하나만 정의할 수 있다.",
    "answer": false
  },
  {
    "q": "클래스로부터 만들어진 각각의 객체를 인스턴스(instance)라고 부른다.",
    "answer": true
  },
  {
    "q": "try 블록 안에서 예외가 발생하면 except 블록을 거치지 않고 항상 프로그램이 즉시 종료된다.",
    "answer": false
  },
  {
    "q": "하나의 클래스로부터 여러 개의 객체(인스턴스)를 만들 수 있다.",
    "answer": true
  },
  {
    "q": "함수는 여러 개의 값을 튜플 형태로 동시에 반환할 수 있다.",
    "answer": true
  },
  {
    "q": "클래스는 def 키워드를 사용하여 정의한다.",
    "answer": false
  },
  {
    "q": "len() 함수로는 리스트의 요소 개수를 구할 수 없다.",
    "answer": false
  },
  {
    "q": "정수(int)와 문자열(str)은 + 연산자로 별도의 형 변환 없이 바로 더할 수 있다.",
    "answer": false
  },
  {
    "q": "0으로 숫자를 나누면 ZeroDivisionError가 발생한다.",
    "answer": true
  },
  {
    "q": "불(bool) 자료형의 값은 True와 False 두 가지뿐이다.",
    "answer": true
  },
  {
    "q": "__init__ 메서드는 객체를 삭제할 때 호출되는 메서드이다.",
    "answer": false
  },
  {
    "q": "함수 안에서 선언한 지역 변수는 함수 종료 후에도 외부에서 그대로 사용할 수 있다.",
    "answer": false
  },
  {
    "q": "튜플은 { }를 사용하여 생성한다.",
    "answer": false
  },
  {
    "q": "함수는 값을 단 하나만 반환할 수 있으며 여러 값을 동시에 반환하는 것은 불가능하다.",
    "answer": false
  },
  {
    "q": "and 연산자는 두 조건 중 하나만 참이어도 전체 결과가 True가 된다.",
    "answer": false
  },
  {
    "q": "if문에서 조건이 거짓이면 else 블록의 코드가 실행된다.",
    "answer": true
  },
  {
    "q": "클래스의 메서드는 첫 번째 매개변수로 일반적으로 self를 받는다.",
    "answer": true
  },
  {
    "q": "__init__ 메서드는 객체가 생성될 때 자동으로 호출되는 생성자 메서드이다.",
    "answer": true
  },
  {
    "q": "파이썬에서 변수를 선언할 때 자료형을 미리 지정하지 않아도 된다.",
    "answer": true
  },
  {
    "q": "딕셔너리에서 같은 key를 중복해서 저장하면 모두 별도로 저장된다.",
    "answer": false
  },
  {
    "q": "리스트는 음수 인덱스를 사용하여 뒤에서부터 요소에 접근할 수 있다.",
    "answer": true
  },
  {
    "q": "리스트 안에는 다른 리스트를 요소로 넣을 수 없다.",
    "answer": false
  },
  {
    "q": "파이썬에서 정수를 실수로 나누면(예: 7 / 2) 항상 정수 결과만 반환된다.",
    "answer": false
  },
  {
    "q": "딕셔너리는 리스트처럼 순서가 있는 인덱스 번호로만 요소에 접근할 수 있다.",
    "answer": false
  },
  {
    "q": "존재하지 않는 변수를 사용하면 NameError가 발생할 수 있다.",
    "answer": true
  },
  {
    "q": "append() 메서드는 리스트의 맨 뒤에 새로운 요소를 추가한다.",
    "answer": true
  },
  {
    "q": "튜플은 리스트처럼 요소를 추가하거나 삭제하는 메서드를 사용할 수 있다.",
    "answer": false
  },
  {
    "q": "튜플은 ( )를 사용하여 생성하며, 생성 후 요소를 변경할 수 없다.",
    "answer": true
  },
  {
    "q": "슬라이싱 s[1:4]는 인덱스 1부터 4까지(4를 포함하여) 문자를 반환한다.",
    "answer": false
  },
  {
    "q": "함수를 정의할 때는 반드시 return문을 작성해야 한다.",
    "answer": false
  },
  {
    "q": "파이썬에서 변수명은 숫자로 시작할 수 있다.",
    "answer": false
  },
  {
    "q": "set은 리스트처럼 동일한 값을 여러 번 중복해서 저장할 수 있다.",
    "answer": false
  },
  {
    "q": "for문은 반드시 range() 함수와 함께 사용해야 하며 리스트는 순회할 수 없다.",
    "answer": false
  },
  {
    "q": "클래스를 통해 속성(attribute)과 메서드(method)를 하나로 묶어서 관리할 수 있다.",
    "answer": true
  },
  {
    "q": "None은 숫자 0과 완전히 같은 값으로 취급된다.",
    "answer": false
  },
  {
    "q": "return문이 없는 함수는 호출 시 None을 반환한다.",
    "answer": true
  },
  {
    "q": "f-string을 사용하면 문자열 안에 변수의 값을 쉽게 삽입할 수 있다.",
    "answer": true
  },
  {
    "q": "not 연산자는 숫자 값을 1 증가시키는 연산자이다.",
    "answer": false
  },
  {
    "q": "함수를 호출할 때 매개변수의 이름을 지정하여 값을 전달할 수 있다(키워드 인자).",
    "answer": true
  },
  {
    "q": "함수는 def 키워드를 사용하여 정의한다.",
    "answer": true
  },
  {
    "q": "예외 처리를 하지 않으면 파이썬은 에러를 무시하고 다음 코드를 계속 실행한다.",
    "answer": false
  },
  {
    "q": "input() 함수로 입력받은 값은 기본적으로 문자열(str) 자료형이다.",
    "answer": true
  },
  {
    "q": "딕셔너리는 key와 value의 쌍으로 데이터를 저장한다.",
    "answer": true
  },
  {
    "q": "정수를 0으로 나누어도 파이썬에서는 아무 문제 없이 무한대 값을 반환한다.",
    "answer": false
  },
  {
    "q": "try-except 구문을 사용하면 예외(에러)가 발생했을 때 프로그램이 강제로 종료되지 않도록 처리할 수 있다.",
    "answer": true
  },
  {
    "q": "except문을 사용하여 특정 종류의 예외만 선택적으로 처리할 수 있다.",
    "answer": true
  },
  {
    "q": "remove() 메서드는 리스트에서 지정한 인덱스 번호의 요소를 삭제한다.",
    "answer": false
  },
  {
    "q": "split() 메서드는 여러 문자열을 하나로 합쳐주는 기능을 한다.",
    "answer": false
  },
  {
    "q": "continue문은 현재 반복을 건너뛰고 다음 반복으로 넘어간다.",
    "answer": true
  },
  {
    "q": "set은 중복된 값을 자동으로 하나만 남기고 제거한다.",
    "answer": true
  },
  {
    "q": "'Hello'.lower()는 'hello'를 반환한다.",
    "answer": true
  },
  {
    "q": "파이썬 함수는 반드시 하나 이상의 매개변수를 가져야 한다.",
    "answer": false
  },
  {
    "q": "함수 이름 뒤에는 소괄호 없이 콜론만 붙여서 정의한다.",
    "answer": false
  },
  {
    "q": "파이썬에서 ==과 =는 같은 의미로 사용된다.",
    "answer": false
  },
  {
    "q": "for i in range(0, 10, 2)는 0, 2, 4, 6, 8을 순서대로 생성한다.",
    "answer": true
  },
  {
    "q": "finally 블록은 예외 발생 여부와 상관없이 항상 실행된다.",
    "answer": true
  },
  {
    "q": "while문은 조건이 참인 동안 반복해서 코드를 실행한다.",
    "answer": true
  },
  {
    "q": "튜플의 요소는 생성된 이후에 자유롭게 수정할 수 있다.",
    "answer": false
  },
  {
    "q": "파이썬에서 #는 한 줄 주석을 작성할 때 사용한다.",
    "answer": true
  },
  {
    "q": "리스트의 pop() 메서드는 인자를 주지 않으면 리스트의 마지막 요소를 제거하고 반환한다.",
    "answer": true
  },
  {
    "q": "람다(lambda) 함수는 여러 줄의 복잡한 로직을 작성하기 위한 함수이다.",
    "answer": false
  },
  {
    "q": "클래스로는 단 하나의 객체만 생성할 수 있다.",
    "answer": false
  },
  {
    "q": "빈 set을 만들 때는 {}가 아니라 set()을 사용해야 한다.",
    "answer": true
  },
  {
    "q": "비교 연산자 ==는 두 값이 서로 같은지를 비교한다.",
    "answer": true
  },
  {
    "q": "튜플도 리스트처럼 인덱싱과 슬라이싱이 가능하다.",
    "answer": true
  },
  {
    "q": "keys(), values(), items() 메서드를 사용하면 각각 키, 값, 키-값 쌍을 가져올 수 있다.",
    "answer": true
  },
  {
    "q": "break문은 현재 반복만 건너뛰고 다음 반복으로 넘어가는 명령어이다.",
    "answer": false
  },
  {
    "q": "클래스의 메서드에서 self는 생략해도 항상 정상적으로 동작한다.",
    "answer": false
  },
  {
    "q": "파이썬에서 변수의 자료형은 한 번 정해지면 프로그램이 끝날 때까지 변경할 수 없다.",
    "answer": false
  },
  {
    "q": "문자열은 생성된 후에도 특정 인덱스의 문자를 직접 바꿀 수 있다(예: s[0] = 'a').",
    "answer": false
  },
  {
    "q": "문자열을 연결할 때는 - 연산자를 사용한다.",
    "answer": false
  },
  {
    "q": "range(5)는 1부터 5까지의 숫자를 생성한다.",
    "answer": false
  },
  {
    "q": "문자열은 인덱싱을 통해 특정 위치의 문자에 접근할 수 있다.",
    "answer": true
  },
  {
    "q": "함수 안에서 정의된 변수는 기본적으로 함수 외부에서 접근할 수 없다(지역 변수).",
    "answer": true
  },
  {
    "q": "파이썬 리스트의 인덱스는 1부터 시작한다.",
    "answer": false
  },
  {
    "q": "'abc' == 'ABC'는 True를 반환한다.",
    "answer": false
  },
  {
    "q": "함수는 class 키워드를 사용하여 정의한다.",
    "answer": false
  },
  {
    "q": "리스트는 한 번 생성되면 요소를 추가하거나 삭제할 수 없다.",
    "answer": false
  },
  {
    "q": "파이썬에서는 코드의 들여쓰기가 실행 결과에 아무런 영향을 주지 않는다.",
    "answer": false
  },
  {
    "q": "파이썬의 if문은 조건문 끝에 콜론(:)을 쓰지 않아도 정상적으로 실행된다.",
    "answer": false
  },
  {
    "q": "리스트는 [ ]를 사용하여 생성한다.",
    "answer": true
  },
  {
    "q": "클래스는 class 키워드를 사용하여 정의한다.",
    "answer": true
  },
  {
    "q": "type() 함수를 사용하면 변수의 자료형을 확인할 수 있다.",
    "answer": true
  },
  {
    "q": "파이썬에서 들여쓰기는 코드 블록을 구분하는 문법적 요소이다.",
    "answer": true
  },
  {
    "q": "set은 저장된 순서를 보장하며 인덱스로 요소에 접근할 수 있다.",
    "answer": false
  },
  {
    "q": "딕셔너리는 { }를 사용하여 생성한다.",
    "answer": true
  },
  {
    "q": "리스트의 요소는 인덱스를 통해 값을 수정할 수 있다.",
    "answer": true
  },
  {"q": "파이썬에서 변수는 선언 시 자료형을 명시하지 않아도 된다.", "answer": true},
  {"q": "print() 함수의 기본 구분자(sep)는 쉼표(,)이다.", "answer": false},
  {"q": "리스트(list)는 대괄호 []를 사용하여 생성한다.", "answer": true},
  {"q": "딕셔너리(dict)의 key는 중복을 허용한다.", "answer": false},
  {"q": "튜플(tuple)은 생성 후 요소의 값을 변경할 수 없다.", "answer": true},
  {"q": "문자열(string)은 인덱싱을 통해 개별 문자를 변경할 수 있다.", "answer": false},
  {"q": "집합(set)은 중복된 값을 허용하지 않는다.", "answer": true},
  {"q": "for문에서 range(1, 10, 2)는 1부터 10까지 짝수를 생성한다.", "answer": false},
  {"q": "while문은 조건이 참(True)인 동안 반복 실행된다.", "answer": true},
  {"q": "파이썬에서 들여쓰기(indentation)는 코드 실행에 영향을 주지 않는다.", "answer": false},
  {"q": "함수에서 return문이 없으면 자동으로 0을 반환한다.", "answer": false},
  {"q": "if-elif-else 구문에서 elif는 여러 번 사용할 수 있다.", "answer": true},
  {"q": "람다(lambda) 함수는 여러 줄의 문장을 포함할 수 있다.", "answer": false},
  {"q": "함수는 def 키워드로 정의한다.", "answer": true},
  {"q": "self는 파이썬의 예약어(keyword)이다.", "answer": false},
  {"q": "함수의 매개변수에는 기본값을 지정할 수 있다.", "answer": true},
  {"q": "파이썬은 다중 상속(multiple inheritance)을 지원하지 않는다.", "answer": false},
  {"q": "*args는 여러 개의 위치 인자를 튜플로 받는다.", "answer": true},
  {"q": "except 블록 없이 try 블록만 단독으로 사용할 수 있다.", "answer": false},
  {"q": "**kwargs는 여러 개의 키워드 인자를 딕셔너리로 받는다.", "answer": true},
  {"q": "ZeroDivisionError는 문자열을 정수로 변환할 때 발생하는 예외이다.", "answer": false},
  {"q": "클래스는 class 키워드로 정의한다.", "answer": true},
  {"q": "딕셔너리는 순서가 보장되지 않는 자료구조이며 파이썬 3.7 이상에서도 마찬가지이다.", "answer": false},
  {"q": "__init__ 메서드는 객체가 생성될 때 자동으로 호출된다.", "answer": true},
  {"q": "append() 메서드는 리스트의 특정 인덱스에 요소를 삽입한다.", "answer": false},
  {"q": "클래스의 인스턴스 변수는 self를 통해 접근한다.", "answer": true},
  {"q": "파이썬에서 == 연산자와 is 연산자는 항상 동일한 결과를 반환한다.", "answer": false},
  {"q": "try-except 구문은 예외 처리를 위해 사용된다.", "answer": true},
  {"q": "정수(int)와 실수(float)를 더하면 항상 오류가 발생한다.", "answer": false},
  {"q": "finally 블록은 예외 발생 여부와 관계없이 항상 실행된다.", "answer": true},
  {"q": "변수명은 숫자로 시작할 수 있다.", "answer": false},
  {"q": "raise 키워드를 사용하여 예외를 직접 발생시킬 수 있다.", "answer": true},
  {"q": "파이썬에서 세미콜론(;)은 문장의 끝에 반드시 필요하다.", "answer": false},
  {"q": "import 키워드를 사용하여 외부 모듈을 가져올 수 있다.", "answer": true},
  {"q": "딕셔너리의 값(value)은 키(key)와 마찬가지로 변경 불가능한(immutable) 자료형만 가능하다.", "answer": false},
  {"q": "len() 함수는 리스트, 문자열, 딕셔너리 등의 길이를 반환한다.", "answer": true},
  {"q": "continue문은 반복문을 즉시 종료시킨다.", "answer": false},
  {"q": "pop() 메서드는 리스트에서 요소를 제거하고 그 값을 반환한다.", "answer": true},
  {"q": "파이썬의 리스트는 서로 다른 자료형의 요소를 함께 저장할 수 없다.", "answer": false},
  {"q": "슬라이싱(slicing)은 콜론(:)을 사용하여 범위를 지정한다.", "answer": true},
  {"q": "빈 중괄호 {}는 빈 set을 생성한다.", "answer": false},
  {"q": "not, and, or는 파이썬의 논리 연산자이다.", "answer": true},
  {"q": "파이썬의 for문은 반드시 range() 함수와 함께 사용해야 한다.", "answer": false},
  {"q": "boolean 자료형은 True와 False 두 가지 값을 가진다.", "answer": true},
  {"q": "정수와 문자열은 + 연산자로 바로 연결할 수 있다.", "answer": false},
  {"q": "type() 함수는 변수의 자료형을 반환한다.", "answer": true},
  {"q": "int(\"3.5\")는 정상적으로 3을 반환한다.", "answer": false},
  {"q": "변수명에는 언더스코어(_)를 사용할 수 있다.", "answer": true},
  {"q": "나눗셈 연산자 //는 항상 실수(float)를 반환한다.", "answer": false},
  {"q": "문자열은 단일 인용부호(')나 이중 인용부호(\")로 생성할 수 있다.", "answer": true},
  {"q": "파이썬에서 == 연산자는 대입(assignment)에 사용된다.", "answer": false},
  {"q": "break문은 반복문을 즉시 종료시킨다.", "answer": true},
  {"q": "파이썬 리스트의 인덱스는 1부터 시작한다.", "answer": false},
  {"q": "함수 내부에서 global 키워드를 사용하면 전역 변수를 수정할 수 있다.", "answer": true},
  {"q": "sorted() 함수는 원본 리스트를 직접 변경한다.", "answer": false},
  {"q": "딕셔너리는 key:value 쌍으로 데이터를 저장한다.", "answer": true},
  {"q": "튜플은 소괄호 없이 생성할 수 없다.", "answer": false},
  {"q": "set 자료형은 중괄호 { }를 사용하여 생성할 수 있다.", "answer": true},
  {"q": "리스트와 튜플은 모두 변경 가능한(mutable) 자료형이다.", "answer": false},
  {"q": "빈 딕셔너리는 dict() 또는 {}로 생성할 수 있다.", "answer": true},
  {"q": "클래스 변수(class variable)는 모든 인스턴스가 공유하지 않는다.", "answer": false},
  {"q": "빈 set은 set()으로 생성해야 한다.", "answer": true},
  {"q": "파이썬에서 함수는 여러 개의 값을 동시에 반환할 수 없다.", "answer": false},
  {"q": "문자열은 + 연산자로 연결(concatenation)할 수 있다.", "answer": true},
  {"q": "pass 키워드는 반복문을 종료시킨다.", "answer": false},
  {"q": "int() 함수는 문자열이나 실수를 정수로 변환할 수 있다.", "answer": true},
  {"q": "try-except 구문에서 else 블록은 사용할 수 없다.", "answer": false},
  {"q": "float() 함수는 정수나 문자열을 실수로 변환할 수 있다.", "answer": true},
  {"q": "open() 함수로 연 파일은 close()를 호출하지 않아도 항상 자동으로 닫힌다.", "answer": false},
  {"q": "나눗셈 연산자 /는 항상 실수(float)를 반환한다.", "answer": true},
  {"q": "정수형 변수는 한 번 선언되면 자료형을 바꿀 수 없다.", "answer": false},
  {"q": "% 연산자는 나눗셈의 나머지를 반환한다.", "answer": true},
  {"q": "비교 연산자 !=는 두 값이 같은지를 확인한다.", "answer": false},
  {"q": "리스트는 인덱스를 통해 특정 요소에 접근할 수 있다.", "answer": true},
  {"q": "파이썬의 함수는 다른 함수의 인자로 전달할 수 없다.", "answer": false},
  {"q": "sort() 메서드는 리스트를 원본에서 직접 정렬한다.", "answer": true},
  {"q": "리스트의 길이를 구할 때는 length() 메서드를 사용한다.", "answer": false},
  {"q": "del 키워드를 사용하여 리스트의 요소를 삭제할 수 있다.", "answer": true},
  {"q": "range(5)는 1부터 5까지의 정수를 생성한다.", "answer": false},
  {"q": "딕셔너리에서 존재하지 않는 key로 접근하면 KeyError가 발생한다.", "answer": true},
  {"q": "리스트 컴프리헨션은 소괄호 ()를 사용하여 작성한다.", "answer": false},
  {"q": "클래스의 메서드는 첫 번째 매개변수로 self를 받는 것이 일반적이다.", "answer": true},
  {"q": "파이썬의 주석은 //로 시작한다.", "answer": false},
  {"q": "상속을 받은 자식 클래스는 부모 클래스의 메서드를 사용할 수 있다.", "answer": true},
  {"q": "in 연산자는 컬렉션에 특정 값이 몇 번 등장하는지 횟수를 반환한다.", "answer": false},
  {"q": "super() 함수는 부모 클래스의 메서드를 호출할 때 사용한다.", "answer": true},
  {"q": "str() 함수는 문자열을 정수로 변환한다.", "answer": false},
  {"q": "pass 키워드는 아무 동작도 하지 않는 자리표시자(placeholder)이다.", "answer": true},
  {"q": "** 연산자는 두 값을 나눈 나머지를 계산한다.", "answer": false},
  {"q": "예외 처리에서 여러 개의 except 블록을 사용할 수 있다.", "answer": true},
  {"q": "음수 인덱스를 사용하면 항상 IndexError가 발생한다.", "answer": false},
  {"q": "with문은 파일과 같은 리소스를 자동으로 닫아준다.", "answer": true},
  {"q": "딕셔너리의 get() 메서드는 key가 없을 때 항상 KeyError를 발생시킨다.", "answer": false},
  {"q": "부울(bool) 값 True는 정수 1과 같은 값으로 취급될 수 있다.", "answer": true},
  {"q": "docstring은 코드 실행 시 항상 자동으로 화면에 출력된다.", "answer": false},
  {"q": "None은 값이 없음을 나타내는 파이썬의 특수한 자료형이다.", "answer": true},
  {"q": "파이썬에서 모든 값은 객체가 아니라 원시 자료형(primitive type)으로 처리된다.", "answer": false},
  {"q": "함수는 다른 함수 내부에 정의할 수 있다(중첩 함수).", "answer": true},
  {"q": "== 연산자는 두 변수의 메모리 주소가 같은지를 비교한다.", "answer": false},
  {"q": "딕셔너리의 키(key)는 변경 불가능한(immutable) 자료형이어야 한다.", "answer": true}
]
