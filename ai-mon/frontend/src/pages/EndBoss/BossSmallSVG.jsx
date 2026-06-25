import endbossOrgImg from '../../assets/endboss_finalorg.png'
import endbossQnaImg from '../../assets/endboss_finalqna.png'

export default function BossSmallSVG({ phaseStyle = 1 }) {
  const src = phaseStyle >= 2 ? endbossQnaImg : endbossOrgImg
  const filterStyle = phaseStyle === 3
    ? 'drop-shadow(0 0 20px rgba(239,68,68,.6))'
    : phaseStyle === 2
      ? 'drop-shadow(0 0 12px rgba(250,199,117,.4))'
      : 'drop-shadow(0 4px 12px rgba(83,74,183,.3))'
  return (
    <img
      src={src}
      alt="엔드보스"
      style={{ width: '90px', height: '90px', objectFit: 'contain', filter: filterStyle }}
    />
  )
}
