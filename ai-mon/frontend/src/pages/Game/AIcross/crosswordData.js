// crosswordData.js 는 원래 crosswordData.json 이었고(3cfc817), JSON → JS 리네임 과정에서
// export 문이 함께 옮겨지지 않아 AICross.jsx 가 기대하는 WORD_SETS/SET_NAMES 를 전혀
// export 하지 않는 상태였다(빌드 실패 원인). 데이터 내용은 그대로 두고 export 만 복구한다.
const CROSSWORD_SETS = [
  {
    "setNumber": 1,
    "setName": "파이썬 기초 & 입출력",
    "words": [
      {
        "id": "python",
        "word": "PYTHON",
        "clue": "AI 학습에 가장 많이 쓰이는 프로그래밍 언어",
        "easyClue": "P로 시작하는, AI 수업에서 가장 많이 쓰는 언어예요."
      },
      {
        "id": "print",
        "word": "PRINT",
        "clue": "화면에 값을 출력하는 가장 기본적인 함수",
        "easyClue": "화면에 글자나 숫자를 보여줄 때 쓰는 명령어예요."
      },
      {
        "id": "loop",
        "word": "LOOP",
        "clue": "for / while로 만드는 반복 구조",
        "easyClue": "같은 동작을 여러 번 반복하게 만드는 구조예요."
      },
      {
        "id": "range",
        "word": "RANGE",
        "clue": "for문에서 연속된 숫자 범위를 만드는 함수",
        "easyClue": "숫자를 순서대로 나열해주는 함수예요. 예: 0,1,2,3,4"
      },
      {
        "id": "input",
        "word": "INPUT",
        "clue": "실행 중에 사용자로부터 값을 입력받는 함수",
        "easyClue": "사람이 키보드로 입력한 값을 받아오는 함수예요."
      },
      {
        "id": "string",
        "word": "STRING",
        "clue": "따옴표로 감싸는 문자 데이터 자료형 — \"hello\"",
        "easyClue": "따옴표(\" \")로 감싼 글자 데이터예요."
      }
    ]
  },
  {
    "setNumber": 2,
    "setName": "리스트 & 자료구조 기초",
    "words": [
      {
        "id": "list",
        "word": "LIST",
        "clue": "순서 있는 데이터 묶음 — [ ]로 표현, 수정 가능",
        "easyClue": "여러 개의 값을 순서대로 담는 상자예요. [ ] 안에 넣어요."
      },
      {
        "id": "tuple",
        "word": "TUPLE",
        "clue": "순서 있지만 수정 불가능한 자료형 — ( )로 표현",
        "easyClue": "리스트랑 비슷하지만 한 번 만들면 바꿀 수 없어요. ( )로 표현해요."
      },
      {
        "id": "index",
        "word": "INDEX",
        "clue": "리스트·문자열의 요소 위치 번호 (0부터 시작)",
        "easyClue": "리스트에서 몇 번째 자리인지 알려주는 번호예요. 첫 번째는 0번!"
      },
      {
        "id": "slice",
        "word": "SLICE",
        "clue": "[시작:끝]으로 리스트·문자열의 일부를 잘라내는 기법",
        "easyClue": "리스트나 문자열에서 원하는 부분만 잘라내는 방법이에요."
      },
      {
        "id": "dict",
        "word": "DICT",
        "clue": "키(key)와 값(value) 쌍으로 저장하는 자료형 — { }",
        "easyClue": "이름표(키)와 내용(값)을 짝지어 저장하는 자료형이에요."
      },
      {
        "id": "append",
        "word": "APPEND",
        "clue": "리스트의 맨 끝에 새 요소를 추가하는 메서드",
        "easyClue": "리스트 맨 뒤에 새로운 값을 하나 추가하는 명령어예요."
      }
    ]
  },
  {
    "setNumber": 3,
    "setName": "제어 키워드 & 함수",
    "words": [
      {
        "id": "return",
        "word": "RETURN",
        "clue": "함수가 결과값을 호출한 곳으로 돌려줄 때 쓰는 키워드",
        "easyClue": "함수의 결과를 밖으로 돌려주는 키워드예요."
      },
      {
        "id": "break",
        "word": "BREAK",
        "clue": "반복문 실행 중 즉시 루프를 탈출하는 키워드",
        "easyClue": "반복문을 그 자리에서 바로 멈추게 하는 키워드예요."
      },
      {
        "id": "while",
        "word": "WHILE",
        "clue": "조건이 참인 동안 계속 반복하는 반복문",
        "easyClue": "조건이 맞는 동안 계속 반복하는 반복문이에요."
      },
      {
        "id": "raise",
        "word": "RAISE",
        "clue": "코드에서 의도적으로 예외를 발생시키는 키워드",
        "easyClue": "일부러 에러를 발생시키는 키워드예요."
      },
      {
        "id": "continue",
        "word": "CONTINUE",
        "clue": "현재 반복을 건너뛰고 다음 반복으로 넘어가는 키워드",
        "easyClue": "이번 반복은 건너뛰고 다음으로 넘어가는 키워드예요."
      },
      {
        "id": "class",
        "word": "CLASS",
        "clue": "객체를 만들기 위한 설계도 — OOP의 핵심 개념",
        "easyClue": "객체를 만들기 위한 설계도예요."
      }
    ]
  },
  {
    "setNumber": 4,
    "setName": "함수 심화 & 변수 범위",
    "words": [
      {
        "id": "scope",
        "word": "SCOPE",
        "clue": "변수가 유효한 범위(전역/지역)를 의미하는 개념",
        "easyClue": "변수가 사용될 수 있는 범위를 뜻해요."
      },
      {
        "id": "lambda",
        "word": "LAMBDA",
        "clue": "이름 없이 한 줄로 정의하는 익명 함수",
        "easyClue": "이름 없이 한 줄로 만드는 짧은 함수예요."
      },
      {
        "id": "global",
        "word": "GLOBAL",
        "clue": "함수 밖에서 선언되어 어디서든 접근 가능한 변수 범위",
        "easyClue": "함수 밖에서도, 어디서든 쓸 수 있는 변수 범위예요."
      },
      {
        "id": "local",
        "word": "LOCAL",
        "clue": "함수 안에서만 사용 가능한 지역 변수의 범위",
        "easyClue": "함수 안에서만 쓸 수 있는 변수 범위예요."
      },
      {
        "id": "value",
        "word": "VALUE",
        "clue": "변수나 키(key)에 저장된 실제 데이터 값",
        "easyClue": "변수나 키에 들어있는 실제 데이터예요."
      },
      {
        "id": "argument",
        "word": "ARGUMENT",
        "clue": "함수를 호출할 때 실제로 전달하는 값",
        "easyClue": "함수를 호출할 때 넘겨주는 실제 값이에요."
      }
    ]
  },
  {
    "setNumber": 5,
    "setName": "자료형",
    "words": [
      {
        "id": "boolean",
        "word": "BOOLEAN",
        "clue": "True 또는 False 두 가지 값만 갖는 논리 자료형",
        "easyClue": "True 또는 False, 둘 중 하나만 되는 자료형이에요."
      },
      {
        "id": "integer",
        "word": "INTEGER",
        "clue": "소수점 없는 정수형 자료형 — int()",
        "easyClue": "소수점이 없는 정수 자료형이에요."
      },
      {
        "id": "float",
        "word": "FLOAT",
        "clue": "소수점이 있는 실수형 자료형",
        "easyClue": "소수점이 있는 실수 자료형이에요."
      },
      {
        "id": "convert",
        "word": "CONVERT",
        "clue": "자료형을 다른 타입으로 바꾸는 것 — int(\"3\") → 3",
        "easyClue": "자료형을 다른 종류로 바꾸는 거예요. 예: int(\"3\") → 3"
      },
      {
        "id": "variable",
        "word": "VARIABLE",
        "clue": "데이터를 저장하기 위해 이름을 붙인 메모리 공간",
        "easyClue": "데이터를 저장할 때 붙이는 이름이에요."
      },
      {
        "id": "type",
        "word": "TYPE",
        "clue": "데이터의 종류를 확인하는 함수",
        "easyClue": "데이터가 어떤 종류인지 확인하고 싶을 때 사용하는 함수예요."
      }
    ]
  },
  {
    "setNumber": 6,
    "setName": "예외처리 & 디버깅",
    "words": [
      {
        "id": "except",
        "word": "EXCEPT",
        "clue": "try 블록에서 오류 발생 시 처리를 담당하는 키워드",
        "easyClue": "에러가 났을 때 처리해주는 부분이에요. try 다음에 와요."
      },
      {
        "id": "error",
        "word": "ERROR",
        "clue": "프로그램 실행 중 발생하는 오류의 총칭",
        "easyClue": "프로그램이 실행 중에 만나는 오류를 뜻해요."
      },
      {
        "id": "debug",
        "word": "DEBUG",
        "clue": "코드의 버그를 찾아서 수정하는 과정",
        "easyClue": "코드에서 버그를 찾아 고치는 과정이에요."
      },
      {
        "id": "syntax",
        "word": "SYNTAX",
        "clue": "프로그래밍 언어의 문법 규칙 — 위반 시 에러 발생",
        "easyClue": "프로그래밍 언어의 문법 규칙이에요."
      },
      {
        "id": "handler",
        "word": "HANDLER",
        "clue": "발생한 예외를 잡아서 처리하는 코드 블록",
        "easyClue": "에러가 났을 때 잡아서 처리해주는 코드예요."
      },
      {
        "id": "comment",
        "word": "COMMENT",
        "clue": "코드 실행에는 영향 없는 설명글 — # 기호로 시작",
        "easyClue": "코드에 남기는 설명 글이에요. #로 시작해요."
      }
    ]
  },
  {
    "setNumber": 7,
    "setName": "모듈 & 패키지",
    "words": [
      {
        "id": "import",
        "word": "IMPORT",
        "clue": "외부 모듈·라이브러리를 현재 파일에 불러오는 키워드",
        "easyClue": "다른 파일이나 라이브러리를 가져와 쓰는 키워드예요."
      },
      {
        "id": "module",
        "word": "MODULE",
        "clue": "파이썬 코드를 담은 .py 파일 단위의 재사용 가능한 묶음",
        "easyClue": "코드를 담아둔 .py 파일 하나를 뜻해요."
      },
      {
        "id": "library",
        "word": "LIBRARY",
        "clue": "특정 기능을 제공하는 모듈 모음 — numpy, pandas 등",
        "easyClue": "여러 기능을 모아둔 모듈 묶음이에요. 예: numpy"
      },
      {
        "id": "install",
        "word": "INSTALL",
        "clue": "pip 명령으로 외부 패키지를 시스템에 설치하는 것",
        "easyClue": "필요한 패키지를 컴퓨터에 설치하는 거예요."
      },
      {
        "id": "package",
        "word": "PACKAGE",
        "clue": "관련 모듈을 폴더 단위로 묶은 것 — __init__.py 포함",
        "easyClue": "여러 모듈을 폴더로 묶어놓은 거예요."
      },
      {
        "id": "version",
        "word": "VERSION",
        "clue": "패키지나 파이썬의 릴리즈 번호 — pip show로 확인",
        "easyClue": "프로그램이나 패키지의 버전 번호예요."
      }
    ]
  },
  {
    "setNumber": 8,
    "setName": "클래스 & OOP",
    "words": [
      {
        "id": "object",
        "word": "OBJECT",
        "clue": "클래스(설계도)로 만들어진 실체 — 속성과 메서드를 가짐",
        "easyClue": "클래스로 만들어진 실제 물건 같은 존재예요."
      },
      {
        "id": "inherit",
        "word": "INHERIT",
        "clue": "부모 클래스의 속성·메서드를 자식 클래스가 물려받는 것",
        "easyClue": "부모 클래스의 기능을 자식이 물려받는 거예요."
      },
      {
        "id": "instance",
        "word": "INSTANCE",
        "clue": "클래스를 통해 실제로 생성된 개별 객체",
        "easyClue": "클래스로 실제 만들어낸 하나의 객체예요."
      },
      {
        "id": "method",
        "word": "METHOD",
        "clue": "클래스 안에 정의된 함수",
        "easyClue": "클래스 안에 들어있는 함수예요."
      },
      {
        "id": "attribute",
        "word": "ATTRIBUTE",
        "clue": "객체가 가지는 데이터(변수) — self.name처럼 접근",
        "easyClue": "객체가 가지고 있는 값(데이터)이에요."
      },
      {
        "id": "parent",
        "word": "PARENT",
        "clue": "상속 관계에서 기능을 물려주는 상위(부모) 클래스",
        "easyClue": "상속할 때 물려주는 쪽인 클래스예요."
      }
    ]
  },
  {
    "setNumber": 9,
    "setName": "정규식",
    "words": [
      {
        "id": "regex",
        "word": "REGEX",
        "clue": "문자열 패턴을 표현하는 정규 표현식의 줄임말",
        "easyClue": "문자열 패턴을 찾을 때 쓰는 표현식이에요."
      },
      {
        "id": "pattern",
        "word": "PATTERN",
        "clue": "정규식에서 찾고자 하는 문자열의 규칙 형태",
        "easyClue": "정규식으로 찾고 싶은 문자열의 모양이에요."
      },
      {
        "id": "match",
        "word": "MATCH",
        "clue": "문자열의 처음부터 패턴 일치 여부를 확인하는 함수",
        "easyClue": "문자열 맨 앞부터 패턴이 맞는지 확인하는 함수예요."
      },
      {
        "id": "search",
        "word": "SEARCH",
        "clue": "문자열 전체에서 패턴을 찾아 첫 번째 결과를 반환하는 함수",
        "easyClue": "문자열 전체에서 패턴을 찾아주는 함수예요."
      },
      {
        "id": "group",
        "word": "GROUP",
        "clue": "정규식에서 괄호 ( )로 묶어 추출한 부분 문자열",
        "easyClue": "정규식에서 괄호로 묶어 뽑아낸 부분이에요."
      },
      {
        "id": "replace",
        "word": "REPLACE",
        "clue": "패턴과 일치하는 부분을 다른 문자열로 치환하는 것",
        "easyClue": "찾은 부분을 다른 글자로 바꾸는 거예요."
      }
    ]
  },
  {
    "setNumber": 10,
    "setName": "API & HTTP 통신",
    "words": [
      {
        "id": "request",
        "word": "REQUEST",
        "clue": "클라이언트가 서버에 데이터를 보내는 HTTP 요청",
        "easyClue": "내가 서버에 데이터를 달라고 보내는 요청이에요."
      },
      {
        "id": "response",
        "word": "RESPONSE",
        "clue": "서버가 요청에 대해 돌려주는 HTTP 응답",
        "easyClue": "서버가 요청에 답으로 보내주는 응답이에요."
      },
      {
        "id": "parse",
        "word": "PARSE",
        "clue": "JSON 등 응답 데이터를 파이썬 객체로 변환하는 것",
        "easyClue": "받은 데이터를 파이썬이 쓸 수 있는 형태로 바꾸는 거예요."
      },
      {
        "id": "header",
        "word": "HEADER",
        "clue": "HTTP 요청·응답에서 메타 정보를 담는 부분 (인증키 등)",
        "easyClue": "요청이나 응답에 붙는 추가 정보예요. 인증키 같은 거요."
      },
      {
        "id": "status",
        "word": "STATUS",
        "clue": "서버 응답의 성공 여부 코드 — 200(성공), 404(없음)",
        "easyClue": "요청이 성공했는지 알려주는 숫자예요. 200이면 성공!"
      },
      {
        "id": "token",
        "word": "TOKEN",
        "clue": "API 인증에 사용되는 임시 접근 키",
        "easyClue": "API를 쓸 때 나를 증명해주는 열쇠 같은 값이에요."
      }
    ]
  },
  {
    "setNumber": 11,
    "setName": "문자열 메서드",
    "words": [
      {
        "id": "split",
        "word": "SPLIT",
        "clue": "구분자를 기준으로 문자열을 나누어 리스트로 반환하는 메서드",
        "easyClue": "문자열을 특정 기준으로 잘라 리스트로 만드는 메서드예요."
      },
      {
        "id": "join",
        "word": "JOIN",
        "clue": "리스트의 요소들을 구분자로 연결해 하나의 문자열로 만드는 메서드",
        "easyClue": "리스트의 글자들을 하나로 이어 붙이는 메서드예요."
      },
      {
        "id": "upper",
        "word": "UPPER",
        "clue": "문자열의 모든 알파벳을 대문자로 바꾸는 메서드",
        "easyClue": "글자를 모두 대문자로 바꾸는 메서드예요."
      },
      {
        "id": "lower",
        "word": "LOWER",
        "clue": "문자열의 모든 알파벳을 소문자로 바꾸는 메서드",
        "easyClue": "글자를 모두 소문자로 바꾸는 메서드예요."
      },
      {
        "id": "strip",
        "word": "STRIP",
        "clue": "문자열 앞뒤의 공백(또는 지정 문자)을 제거하는 메서드",
        "easyClue": "문자열 앞뒤의 빈 공백을 없애는 메서드예요."
      },
      {
        "id": "format",
        "word": "FORMAT",
        "clue": "문자열 안에 변수 값을 삽입하는 메서드 — \"{}\".format(값)",
        "easyClue": "문자열 안에 값을 끼워 넣는 메서드예요."
      }
    ]
  },
  {
    "setNumber": 12,
    "setName": "리스트 고급 조작",
    "words": [
      {
        "id": "sort",
        "word": "SORT",
        "clue": "리스트 요소를 오름차순/내림차순으로 정렬하는 메서드",
        "easyClue": "리스트를 순서대로 정렬하는 메서드예요."
      },
      {
        "id": "reverse",
        "word": "REVERSE",
        "clue": "리스트의 요소 순서를 거꾸로 뒤집는 메서드",
        "easyClue": "리스트의 순서를 거꾸로 뒤집는 메서드예요."
      },
      {
        "id": "filter",
        "word": "FILTER",
        "clue": "조건 함수를 만족하는 요소만 걸러내는 고차 함수",
        "easyClue": "조건에 맞는 것만 골라내는 함수예요."
      },
      {
        "id": "iterator",
        "word": "ITERATOR",
        "clue": "next()로 요소를 하나씩 꺼낼 수 있는 반복 가능한 객체",
        "easyClue": "하나씩 꺼내 쓸 수 있는 반복 가능한 객체예요."
      },
      {
        "id": "enumerate",
        "word": "ENUMERATE",
        "clue": "반복 시 인덱스와 값을 동시에 반환하는 내장 함수",
        "easyClue": "반복할 때 순서 번호와 값을 같이 주는 함수예요."
      },
      {
        "id": "generator",
        "word": "GENERATOR",
        "clue": "yield 키워드로 값을 하나씩 생산하는 특수 함수",
        "easyClue": "값을 하나씩 만들어내는 특별한 함수예요. yield를 써요."
      }
    ]
  },
  {
    "setNumber": 13,
    "setName": "파일 처리",
    "words": [
      {
        "id": "file",
        "word": "FILE",
        "clue": "데이터를 저장하거나 읽어오는 디스크 상의 파일 객체",
        "easyClue": "컴퓨터에 저장된 파일을 다루는 객체예요."
      },
      {
        "id": "open",
        "word": "OPEN",
        "clue": "파일을 읽기·쓰기 모드로 열어 파일 객체를 반환하는 함수",
        "easyClue": "파일을 읽거나 쓰기 위해 여는 함수예요."
      },
      {
        "id": "read",
        "word": "READ",
        "clue": "파일의 내용을 문자열로 읽어오는 메서드",
        "easyClue": "파일의 내용을 읽어오는 메서드예요."
      },
      {
        "id": "write",
        "word": "WRITE",
        "clue": "파일에 문자열 데이터를 저장하는 메서드",
        "easyClue": "파일에 내용을 써서 저장하는 메서드예요."
      },
      {
        "id": "close",
        "word": "CLOSE",
        "clue": "사용이 끝난 파일 객체를 닫아 자원을 해제하는 메서드",
        "easyClue": "다 쓴 파일을 닫아주는 메서드예요."
      },
      {
        "id": "path",
        "word": "PATH",
        "clue": "파일이나 폴더가 위치한 경로를 나타내는 문자열",
        "easyClue": "파일이 있는 위치(경로)를 나타내는 문자열이에요."
      }
    ]
  },
  {
    "setNumber": 14,
    "setName": "딕셔너리 심화",
    "words": [
      {
        "id": "update",
        "word": "UPDATE",
        "clue": "딕셔너리에 새 키-값 쌍을 추가하거나 기존 값을 수정하는 메서드",
        "easyClue": "딕셔너리에 새 값을 추가하거나 바꾸는 메서드예요."
      },
      {
        "id": "items",
        "word": "ITEMS",
        "clue": "딕셔너리의 키-값 쌍을 튜플 형태로 모두 반환하는 메서드",
        "easyClue": "딕셔너리의 키와 값을 짝으로 모두 꺼내는 메서드예요."
      },
      {
        "id": "values",
        "word": "VALUES",
        "clue": "딕셔너리에 저장된 모든 값(value)을 반환하는 메서드",
        "easyClue": "딕셔너리에 있는 값들만 모두 꺼내는 메서드예요."
      },
      {
        "id": "keys",
        "word": "KEYS",
        "clue": "딕셔너리에 저장된 모든 키(key)를 반환하는 메서드",
        "easyClue": "딕셔너리에 있는 키들만 모두 꺼내는 메서드예요."
      },
      {
        "id": "nested",
        "word": "NESTED",
        "clue": "딕셔너리나 리스트 안에 또 다른 자료구조가 중첩된 구조",
        "easyClue": "자료구조 안에 또 다른 자료구조가 들어있는 구조예요."
      },
      {
        "id": "mapping",
        "word": "MAPPING",
        "clue": "키(key)와 값(value)을 연결하는 딕셔너리 계열 자료형의 특성",
        "easyClue": "키와 값을 서로 연결해주는 딕셔너리의 특징이에요."
      }
    ]
  },
  {
    "setNumber": 15,
    "setName": "OOP 심화",
    "words": [
      {
        "id": "super",
        "word": "SUPER",
        "clue": "자식 클래스에서 부모 클래스의 메서드를 호출할 때 쓰는 함수",
        "easyClue": "자식 클래스에서 부모 클래스를 불러올 때 쓰는 함수예요."
      },
      {
        "id": "self",
        "word": "SELF",
        "clue": "클래스 내에서 인스턴스 자기 자신을 참조하는 키워드",
        "easyClue": "클래스 안에서 자기 자신을 가리키는 키워드예요."
      },
      {
        "id": "decorator",
        "word": "DECORATOR",
        "clue": "함수나 클래스를 감싸서 기능을 추가하는 @표기 패턴",
        "easyClue": "함수에 기능을 덧붙여주는 @표시 문법이에요."
      },
      {
        "id": "abstract",
        "word": "ABSTRACT",
        "clue": "구현 없이 인터페이스만 정의하는 추상 클래스의 특성",
        "easyClue": "구체적인 내용 없이 틀만 정해놓은 클래스예요."
      },
      {
        "id": "property",
        "word": "PROPERTY",
        "clue": "메서드를 속성처럼 접근할 수 있게 해주는 내장 데코레이터",
        "easyClue": "메서드를 변수처럼 쓸 수 있게 해주는 기능이에요."
      },
      {
        "id": "override",
        "word": "OVERRIDE",
        "clue": "자식 클래스에서 부모의 메서드를 재정의하는 것",
        "easyClue": "부모의 메서드를 자식이 다시 새로 정의하는 거예요."
      }
    ]
  },
  {
    "setNumber": 16,
    "setName": "비동기 & 고급 문법",
    "words": [
      {
        "id": "async",
        "word": "ASYNC",
        "clue": "비동기 함수를 정의할 때 def 앞에 붙이는 키워드",
        "easyClue": "비동기 함수를 만들 때 앞에 붙이는 키워드예요."
      },
      {
        "id": "await",
        "word": "AWAIT",
        "clue": "비동기 함수 안에서 코루틴 실행 완료를 기다리는 키워드",
        "easyClue": "비동기 작업이 끝날 때까지 기다리는 키워드예요."
      },
      {
        "id": "task",
        "word": "TASK",
        "clue": "asyncio에서 코루틴을 동시에 실행하기 위해 감싸는 단위",
        "easyClue": "동시에 실행할 작업을 감싸는 단위예요."
      },
      {
        "id": "stream",
        "word": "STREAM",
        "clue": "데이터를 한꺼번에 받지 않고 조금씩 연속으로 받는 방식",
        "easyClue": "데이터를 한번에 다 받지 않고 조금씩 받는 방식이에요."
      },
      {
        "id": "context",
        "word": "CONTEXT",
        "clue": "with문과 함께 쓰는 자원 관리 객체 — __enter__/__exit__ 구현",
        "easyClue": "with문과 함께 자원을 관리해주는 객체예요."
      },
      {
        "id": "pipeline",
        "word": "PIPELINE",
        "clue": "여러 처리 단계를 체인처럼 연결한 데이터 흐름 구조",
        "easyClue": "여러 처리 단계를 순서대로 이어놓은 흐름이에요."
      }
    ]
  },
  {
    "setNumber": 17,
    "setName": "LLM & AI 기초",
    "words": [
      {
        "id": "prompt",
        "word": "PROMPT",
        "clue": "AI 모델에 입력하는 질문 또는 지시문",
        "easyClue": "AI에게 물어보거나 시키는 질문·지시문이에요."
      },
      {
        "id": "model",
        "word": "MODEL",
        "clue": "학습된 AI 알고리즘 — GPT, Claude 등",
        "easyClue": "학습이 끝난 AI 프로그램이에요. 예: GPT, Claude"
      },
      {
        "id": "agent",
        "word": "AGENT",
        "clue": "도구를 사용해 목표를 달성하는 자율 AI 프로그램",
        "easyClue": "도구를 써서 스스로 일을 처리하는 AI 프로그램이에요."
      },
      {
        "id": "chain",
        "word": "CHAIN",
        "clue": "Lang...에서 여러 처리 단계를 연결한 파이프라인",
        "easyClue": "여러 처리 단계를 연결해놓은 흐름이에요."
      },
      {
        "id": "memory",
        "word": "MEMORY",
        "clue": "챗봇이 이전 대화 내용을 기억하는 기능",
        "easyClue": "챗봇이 이전 대화를 기억하는 기능이에요."
      },
      {
        "id": "deploy",
        "word": "DEPLOY",
        "clue": "개발한 AI 앱을 서버에 올려 사용 가능하게 배포하는 것",
        "easyClue": "만든 AI 앱을 실제로 쓸 수 있게 서버에 올리는 거예요."
      }
    ]
  },
  {
    "setNumber": 18,
    "setName": "데이터 & API 심화",
    "words": [
      {
        "id": "endpoint",
        "word": "ENDPOINT",
        "clue": "API에서 특정 기능에 접근하는 URL 경로",
        "easyClue": "API에서 특정 기능으로 연결되는 주소예요."
      },
      {
        "id": "payload",
        "word": "PAYLOAD",
        "clue": "HTTP 요청·응답에서 실제로 전달되는 데이터 본문",
        "easyClue": "요청이나 응답에 실제로 담기는 데이터예요."
      },
      {
        "id": "schema",
        "word": "SCHEMA",
        "clue": "데이터의 구조와 형식을 정의한 설계도",
        "easyClue": "데이터가 어떤 모양인지 정해놓은 설계도예요."
      },
      {
        "id": "query",
        "word": "QUERY",
        "clue": "데이터베이스나 API에 원하는 데이터를 요청하는 질의",
        "easyClue": "원하는 데이터를 달라고 요청하는 질문이에요."
      },
      {
        "id": "fetch",
        "word": "FETCH",
        "clue": "서버에서 데이터를 가져오는 HTTP 요청 행위",
        "easyClue": "서버에서 데이터를 가져오는 거예요."
      },
      {
        "id": "encode",
        "word": "ENCODE",
        "clue": "데이터를 특정 형식(URL, Base64 등)으로 변환하는 것",
        "easyClue": "데이터를 다른 형식으로 바꾸는 거예요."
      }
    ]
  },
  {
    "setNumber": 19,
    "setName": "연산자 & 조건",
    "words": [
      {
        "id": "operator",
        "word": "OPERATOR",
        "clue": "연산을 수행하는 기호 — +, -, *, /, ==, != 등",
        "easyClue": "계산을 하는 기호예요. +, -, *, / 같은 거요."
      },
      {
        "id": "condition",
        "word": "CONDITION",
        "clue": "if문에서 참/거짓을 판단하는 조건식",
        "easyClue": "if문에서 참인지 거짓인지 따지는 조건이에요."
      },
      {
        "id": "logical",
        "word": "LOGICAL",
        "clue": "and, or, not처럼 조건을 결합하는 논리 연산의 유형",
        "easyClue": "and, or, not처럼 조건을 합치는 연산이에요."
      },
      {
        "id": "compare",
        "word": "COMPARE",
        "clue": "두 값의 크기나 동일성을 비교하는 연산 — ==, >, < 등",
        "easyClue": "두 값을 비교하는 연산이에요. ==, >, < 같은 거요."
      },
      {
        "id": "assign",
        "word": "ASSIGN",
        "clue": "변수에 값을 저장하는 대입 연산 — = 기호 사용",
        "easyClue": "변수에 값을 넣어주는 것이에요. = 기호를 써요."
      },
      {
        "id": "evaluate",
        "word": "EVALUATE",
        "clue": "수식이나 조건식을 실제 값(True/False 등)으로 계산하는 것",
        "easyClue": "수식이나 조건을 계산해서 실제 값으로 만드는 거예요."
      }
    ]
  },
  {
    "setNumber": 20,
    "setName": "함수 & 실행 구조",
    "words": [
      {
        "id": "function",
        "word": "FUNCTION",
        "clue": "특정 기능을 수행하는 코드 블록 — def 키워드로 정의",
        "easyClue": "특정 일을 하는 코드 묶음이에요. def로 만들어요."
      },
      {
        "id": "parameter",
        "word": "PARAMETER",
        "clue": "함수 정의 시 입력을 받기 위해 선언하는 변수",
        "easyClue": "함수가 입력받기 위해 미리 정해놓은 변수예요."
      },
      {
        "id": "recursion",
        "word": "RECURSION",
        "clue": "함수가 자기 자신을 호출하며 문제를 푸는 방식",
        "easyClue": "함수가 자기 자신을 다시 부르는 방식이에요."
      },
      {
        "id": "stack",
        "word": "STACK",
        "clue": "함수 호출 시 쌓이고 반환 시 줄어드는 메모리 구조 (LIFO)",
        "easyClue": "쌓이고 빠지는 순서로 동작하는 메모리 구조예요."
      },
      {
        "id": "output",
        "word": "OUTPUT",
        "clue": "함수나 프로그램이 실행 결과로 내보내는 값",
        "easyClue": "프로그램이 실행하고 내놓는 결과값이에요."
      },
      {
        "id": "define",
        "word": "DEFINE",
        "clue": "함수나 변수를 선언하여 이름과 기능을 지정하는 것",
        "easyClue": "함수나 변수에 이름과 기능을 정해주는 거예요."
      }
    ]
  },
  {
    "setNumber": 21,
    "setName": "가상환경 & 패키지 관리",
    "words": [
      {
        "id": "venv",
        "word": "VENV",
        "clue": "프로젝트별로 독립된 파이썬 실행 환경을 만드는 표준 모듈",
        "easyClue": "프로젝트마다 따로 독립된 파이썬 환경을 만드는 도구예요."
      },
      {
        "id": "activate",
        "word": "ACTIVATE",
        "clue": "가상환경을 켜서 사용 가능하게 만드는 명령",
        "easyClue": "만들어둔 가상환경을 켜서 쓰기 시작하는 명령이에요."
      },
      {
        "id": "deactivate",
        "word": "DEACTIVATE",
        "clue": "가상환경에서 빠져나와 원래 환경으로 돌아가는 명령어",
        "easyClue": "쓰고 있던 가상환경에서 빠져나오는 명령이에요."
      },
      {
        "id": "pip",
        "word": "PIP",
        "clue": "PyPI에서 패키지를 찾아 설치·삭제해주는 파이썬 패키지 관리 도구",
        "easyClue": "필요한 패키지를 찾아서 설치해주는 도구예요."
      },
      {
        "id": "freeze",
        "word": "FREEZE",
        "clue": "현재 설치된 패키지와 버전을 파일로 저장하는 명령",
        "easyClue": "지금 설치된 패키지 목록을 파일로 저장하는 명령이에요."
      },
      {
        "id": "requirements",
        "word": "REQUIREMENTS",
        "clue": "설치할 패키지 목록을 적어두는 텍스트 파일 (.txt)",
        "easyClue": "설치해야 할 패키지 목록을 적어둔 파일이에요."
      }
    ]
  },
  {
    "setNumber": 22,
    "setName": "튜플 심화 & 패킹-언패킹",
    "words": [
      {
        "id": "unpack",
        "word": "UNPACK",
        "clue": "튜플이나 리스트의 값을 여러 변수에 나눠 담는 것 — a, b = 1, 2",
        "easyClue": "튜플이나 리스트의 값을 여러 변수에 나눠 담는 거예요."
      },
      {
        "id": "packing",
        "word": "PACKING",
        "clue": "괄호 없이 쉼표로 값을 나열해 하나의 튜플로 자동으로 묶는 것",
        "easyClue": "쉼표로 값들을 나열하면 자동으로 튜플이 되는 거예요."
      },
      {
        "id": "immutable",
        "word": "IMMUTABLE",
        "clue": "한 번 만들면 값을 바꿀 수 없는 성질 — 튜플과 문자열의 특징",
        "easyClue": "한 번 만들면 바꿀 수 없는 성질이에요. 튜플이 그래요."
      },
      {
        "id": "mutable",
        "word": "MUTABLE",
        "clue": "생성한 뒤에도 값을 바꿀 수 있는 성질 — 리스트의 특징",
        "easyClue": "만든 뒤에도 값을 바꿀 수 있는 성질이에요. 리스트가 그래요."
      },
      {
        "id": "asterisk",
        "word": "ASTERISK",
        "clue": "언패킹 시 나머지 값을 리스트로 한 번에 받을 때 쓰는 별표 기호 * 의 이름",
        "easyClue": "별표(*) 기호를 부르는 이름이에요. 나머지 값을 받을 때 써요."
      },
      {
        "id": "identity",
        "word": "IDENTITY",
        "clue": "값이 아니라 객체 자체가 같은지 비교하는 성질 — is 연산자로 확인",
        "easyClue": "값이 아니라 객체가 진짜 같은지 비교하는 성질이에요."
      }
    ]
  },
  {
    "setNumber": 23,
    "setName": "함수 심화 — 람다·가변인자·재귀",
    "words": [
      {
        "id": "args",
        "word": "ARGS",
        "clue": "함수에서 개수가 정해지지 않은 위치 인자를 튜플로 받는 문법",
        "easyClue": "개수가 정해지지 않은 값들을 튜플로 받는 문법이에요."
      },
      {
        "id": "kwargs",
        "word": "KWARGS",
        "clue": "함수에서 이름=값 형태의 가변 인자를 딕셔너리로 받는 문법",
        "easyClue": "이름=값 형태의 인자를 딕셔너리로 받는 문법이에요."
      },
      {
        "id": "anonymous",
        "word": "ANONYMOUS",
        "clue": "이름 없이 정의하는 함수를 뜻하는 용어 — lambda가 대표적인 예",
        "easyClue": "이름 없이 만드는 함수를 부르는 말이에요. lambda가 대표적이죠."
      },
      {
        "id": "factorial",
        "word": "FACTORIAL",
        "clue": "재귀 함수의 대표 예제 — n부터 1까지 곱하는 계산, 5! = 120",
        "easyClue": "1부터 n까지 다 곱하는 계산이에요. 5! = 120"
      },
      {
        "id": "iterable",
        "word": "ITERABLE",
        "clue": "for문으로 반복 가능한 객체의 성질 — 리스트, 문자열 등이 해당",
        "easyClue": "for문으로 하나씩 꺼낼 수 있는 성질이에요."
      },
      {
        "id": "map",
        "word": "MAP",
        "clue": "리스트의 모든 요소에 함수를 하나씩 적용하는 고차 함수",
        "easyClue": "리스트의 모든 값에 함수를 하나씩 적용해주는 함수예요."
      }
    ]
  },
  {
    "setNumber": 24,
    "setName": "Streamlit 챗봇",
    "words": [
      {
        "id": "widget",
        "word": "WIDGET",
        "clue": "화면에 입력 요소를 만드는 Streamlit 구성요소 — 버튼, 슬라이더 등",
        "easyClue": "화면에 버튼이나 슬라이더 같은 입력 요소를 만드는 거예요."
      },
      {
        "id": "sidebar",
        "word": "SIDEBAR",
        "clue": "화면 좌측에 별도 영역을 만드는 스트림릿 레이아웃 요소",
        "easyClue": "화면 왼쪽에 따로 만드는 영역이에요."
      },
      {
        "id": "session",
        "word": "SESSION",
        "clue": "새로고침해도 값을 유지시켜주는 상태 저장 객체",
        "easyClue": "새로고침해도 값을 기억해주는 저장소예요."
      },
      {
        "id": "cache",
        "word": "CACHE",
        "clue": "함수 반환값이나 리소스를 저장해 재실행 속도를 높이는 데코레이터",
        "easyClue": "다시 계산 안 하고 저장해둔 결과를 재사용하는 기능이에요."
      },
      {
        "id": "secrets",
        "word": "SECRETS",
        "clue": "API 키 같은 민감한 값을 안전하게 저장·관리하는 설정 파일 (.toml)",
        "easyClue": "API 키처럼 중요한 값을 안전하게 저장하는 파일이에요."
      },
      {
        "id": "rerun",
        "word": "RERUN",
        "clue": "위젯 값이 바뀔 때마다 스크립트를 처음부터 다시 실행하는 Streamlit의 동작 방식",
        "easyClue": "위젯 값이 바뀌면 스크립트를 처음부터 다시 실행하는 거예요."
      }
    ]
  },
  {
    "setNumber": 25,
    "setName": "LangChain & RAG",
    "words": [
      {
        "id": "retriever",
        "word": "RETRIEVER",
        "clue": "질문과 관련된 문서를 벡터 스토어에서 찾아오는 LangChain 구성요소",
        "easyClue": "질문과 관련된 문서를 찾아오는 역할을 해요."
      },
      {
        "id": "embedding",
        "word": "EMBEDDING",
        "clue": "텍스트를 고차원 숫자 벡터로 변환하는 과정 — 의미가 비슷할수록 벡터가 가까움",
        "easyClue": "텍스트를 숫자 벡터로 바꾸는 과정이에요."
      },
      {
        "id": "vectorstore",
        "word": "VECTORSTORE",
        "clue": "임베딩된 문서를 저장하고 유사도 검색을 수행하는 저장소 — FAISS 등",
        "easyClue": "임베딩된 문서를 저장하고 검색하는 저장소예요."
      },
      {
        "id": "chunk",
        "word": "CHUNK",
        "clue": "긴 문서를 작은 조각으로 나누는 것 — RAG의 전처리 과정",
        "easyClue": "긴 문서를 작은 조각으로 나누는 거예요."
      },
      {
        "id": "rag",
        "word": "RAG",
        "clue": "검색으로 찾은 문서를 참고해 LLM이 답변을 생성하는 방식의 줄임말",
        "easyClue": "찾은 문서를 참고해서 AI가 답을 만드는 방식이에요."
      },
      {
        "id": "lcel",
        "word": "LCEL",
        "clue": "파이프 연산자(|)로 프롬프트·모델·파서를 연결하는 LangChain의 표현식 언어",
        "easyClue": "파이프(|) 기호로 여러 단계를 연결하는 LangChain 문법이에요."
      }
    ]
  },
  {
    "setNumber": 26,
    "setName": "AI 에이전트 & Tool Use",
    "words": [
      {
        "id": "register",
        "word": "REGISTER",
        "clue": "도구명과 실행 함수를 매핑해 관리하는 레지스트리에 도구를 등록하는 것",
        "easyClue": "도구 이름과 실행 함수를 연결해서 등록하는 거예요."
      },
      {
        "id": "tooluse",
        "word": "TOOLUSE",
        "clue": "Claude가 도구 호출이 필요할 때 반환하는 stop_reason 값 — tool_use",
        "easyClue": "Claude가 도구를 쓰겠다고 알려주는 신호예요."
      },
      {
        "id": "retry",
        "word": "RETRY",
        "clue": "일시적인 오류가 발생했을 때 같은 작업을 다시 시도하는 안전장치",
        "easyClue": "오류가 났을 때 다시 한번 시도해보는 거예요."
      },
      {
        "id": "iteration",
        "word": "ITERATION",
        "clue": "에이전트 루프가 도구 호출과 결과 전달을 반복하는 한 번의 주기",
        "easyClue": "도구를 부르고 결과를 받는 한 번의 반복이에요."
      },
      {
        "id": "validate",
        "word": "VALIDATE",
        "clue": "도구에 인자를 전달하기 전 필요한 값이 모두 있는지 검증하는 것",
        "easyClue": "도구에 값을 넘기기 전에 제대로 있는지 확인하는 거예요."
      },
      {
        "id": "endturn",
        "word": "ENDTURN",
        "clue": "Claude가 더 이상 도구가 필요 없어 최종 답변을 마쳤다는 stop_reason 값",
        "easyClue": "Claude가 더 할 일이 없어서 답을 끝냈다는 신호예요."
      }
    ]
  },
  {
    "setNumber": 27,
    "setName": "FastAPI & 웹 프로젝트",
    "words": [
      {
        "id": "route",
        "word": "ROUTE",
        "clue": "특정 URL 경로에 대한 처리를 연결하는 FastAPI 엔드포인트 — @app.get()",
        "easyClue": "특정 주소로 오는 요청을 처리하도록 연결하는 거예요."
      },
      {
        "id": "uvicorn",
        "word": "UVICORN",
        "clue": "FastAPI로 만든 앱을 실행시키는 ASGI 서버",
        "easyClue": "FastAPI 앱을 실제로 실행시켜주는 서버예요."
      },
      {
        "id": "middleware",
        "word": "MIDDLEWARE",
        "clue": "요청과 응답 사이에 공통 처리를 끼워 넣는 계층",
        "easyClue": "요청과 응답 사이에서 공통으로 처리해주는 부분이에요."
      },
      {
        "id": "cors",
        "word": "CORS",
        "clue": "다른 출처(origin)의 요청을 허용할지 결정하는 브라우저 보안 정책",
        "easyClue": "다른 출처의 요청을 허용할지 정하는 보안 규칙이에요."
      },
      {
        "id": "database",
        "word": "DATABASE",
        "clue": "데이터를 구조적으로 저장하고 관리하는 저장소 — SQLAlchemy로 연동",
        "easyClue": "데이터를 저장하고 관리하는 저장소예요."
      },
      {
        "id": "orm",
        "word": "ORM",
        "clue": "데이터베이스 테이블을 파이썬 클래스처럼 다루게 해주는 기술 — Object Relational Mapper",
        "easyClue": "데이터베이스 테이블을 파이썬 클래스처럼 다루게 해주는 기술이에요."
      }
    ]
  }
]

// AICross.jsx 가 기대하는 형태로 파생: 세트별 단어 배열(id/word/clue/easyClue 그대로 보존)과
// 세트 이름 배열. 데이터는 CROSSWORD_SETS 하나로 유지하고 여기서만 형태를 맞춘다.
export const WORD_SETS = CROSSWORD_SETS.map((s) => s.words)
export const SET_NAMES = CROSSWORD_SETS.map((s) => s.setName)