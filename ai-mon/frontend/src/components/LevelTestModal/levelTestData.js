import slimeIcon      from '../../assets/character_slime.png'
import robotIcon      from '../../assets/character_robot.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

export const LEVEL_TEST_QUESTIONS = [
  {
    id: 'lt1',
    question: 'Python에서 화면에 글자를 출력하는 함수는?',
    choices: ['show()', 'print()', 'display()', 'echo()'],
    answer: 1,
  },
  {
    id: 'lt2',
    question: "다음 코드의 출력 결과는?\n\nprint('a', 'b', sep='-')",
    choices: ['a b', 'ab', 'a-b', 'a, b'],
    answer: 2,
  },
  {
    id: 'lt3',
    question: "f-string 출력 결과는?\n\nname = '에이몬'\nprint(f'[{name}]')",
    choices: ['[f에이몬]', '[name]', '{에이몬]', '[에이몬]'],
    answer: 3,
  },
  {
    id: 'lt4',
    question: "다음 중 리스트를 만드는 올바른 방법은?",
    choices: ['list = (1, 2, 3)', 'list = {1, 2, 3}', 'list = [1, 2, 3]', 'list = <1, 2, 3>'],
    answer: 2,
  },
  {
    id: 'lt5',
    question: "for 반복문으로 1~5를 출력하려면?\n\nfor i in ___:\n    print(i)",
    choices: ['range(5)', 'range(1, 6)', 'range(1, 5)', 'range(0, 5)'],
    answer: 1,
  },
  {
    id: 'lt6',
    question: "다음 코드의 출력은?\n\nprint(10 // 3)",
    choices: ['3.33', '3', '4', '1'],
    answer: 1,
  },
  {
    id: 'lt7',
    question: "함수를 정의하는 키워드는?",
    choices: ['function', 'func', 'def', 'define'],
    answer: 2,
  },
  {
    id: 'lt8',
    question: "다음 코드의 출력은?\n\nx = [1, 2, 3]\nprint(x[-1])",
    choices: ['1', '2', '3', 'Error'],
    answer: 2,
  },
  {
    id: 'lt9',
    question: "딕셔너리에서 키 'name'의 값을 가져오는 방법은?\n\nd = {'name': '에이몬'}",
    choices: ["d('name')", "d['name']", "d.get['name']", "d{name}"],
    answer: 1,
  },
  {
    id: 'lt10',
    question: "다음 코드의 출력은?\n\ndef add(a, b=10):\n    return a + b\nprint(add(5))",
    choices: ['5', '10', '15', 'Error'],
    answer: 2,
  },
]

export const LEVEL_RESULT = {
  beginner:     { label: '비기너',        icon: slimeIcon,      color: '#7c3aed', msg: '아기 슬라임 에이몬이 기다려요!',       desc: 'Python 기초부터 차근차근 함께해요 😊' },
  intermediate: { label: '인터미디에이트', icon: robotIcon,      color: '#06b6d4', msg: '로봇 에이몬이 당신을 알아봤어요!',    desc: 'print()는 알고, 더 깊이 파고들 준비 완료!' },
  advanced:     { label: '어드밴스드',    icon: finalGhostIcon, color: '#f59e0b', msg: '파이널 에이몬이 라이벌을 발견했어요!', desc: 'f-string까지 꿰뚫는 당신, 에이몬도 긴장했어요 🔥' },
}

/** 틀린 문항 수 → 레벨 키 */
export function calcLevelResult(wrongCount) {
  if (wrongCount <= 2) return 'advanced'
  if (wrongCount <= 6) return 'intermediate'
  return 'beginner'
}
