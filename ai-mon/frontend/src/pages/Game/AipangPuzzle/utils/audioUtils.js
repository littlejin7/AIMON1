// ── 오디오 유틸리티 ──

let acInstance = null;

/** Web Audio Context 싱글톤 */
export function getAudioContext() {
  if (!acInstance) {
    acInstance = new (window.AudioContext || window.webkitAudioContext)();
  }
  return acInstance;
}

/**
 * 단순 비프음 생성
 * @param {number} freq - 주파수 (Hz)
 * @param {number} duration - 재생 시간 (초)
 * @param {string} type - OscillatorType ('sine' | 'square' | 'sawtooth')
 * @param {number} volume - 볼륨 (0~1)
 */
export function beep(freq, duration, type = 'sine', volume = 0.1) {
  try {
    const ac = getAudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    o.start();
    o.stop(ac.currentTime + duration);
  } catch (e) {
    // 오디오 초기화 실패 시 무시
  }
}

/** Promise 기반 딜레이 */
export function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}
