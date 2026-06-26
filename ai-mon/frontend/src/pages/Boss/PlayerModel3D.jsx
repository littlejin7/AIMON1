import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

export default function PlayerModel3D({ myShake, attackAnim }) {
  const { scene } = useGLTF('/models/player.glb')
  const meshRef = useRef()
  const shakeRef = useRef(0)
  const attackProgress = useRef(0)

  useFrame((state) => {
    if (!meshRef.current) return

    // idle - 위아래 부유
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.05

    // 피격 시 좌우 흔들림
    if (myShake) {
      shakeRef.current += 1
      meshRef.current.position.x = Math.sin(shakeRef.current * 0.8) * 0.12
    } else {
      meshRef.current.position.x *= 0.85
      if (Math.abs(meshRef.current.position.x) < 0.001) {
        meshRef.current.position.x = 0
        shakeRef.current = 0
      }
    }

    // 공격 애니메이션 - 앞으로 돌진
    if (attackAnim) {
      attackProgress.current = Math.min(attackProgress.current + 0.07, 1)
    } else {
      attackProgress.current = Math.max(attackProgress.current - 0.1, 0)
    }

    const ap = attackProgress.current
    let az = 0, rx = 0
    if (ap > 0) {
      if (ap < 0.3) {
        // 윈드업 - 뒤로 살짝 당기기
        az = -0.12 * (ap / 0.3)
        rx = 0.12 * (ap / 0.3)
      } else if (ap < 0.7) {
        // 돌진 - 카메라 방향(앞)으로 전진
        const dp = (ap - 0.3) / 0.4
        az = -0.12 + 0.45 * dp
        rx = 0.12 - 0.35 * dp
      } else {
        // 복귀
        const rp = (ap - 0.7) / 0.3
        az = 0.33 - 0.33 * rp
        rx = -0.23 + 0.23 * rp
      }
    }
    meshRef.current.position.z = az
    meshRef.current.rotation.x = rx
  })

  // 피격(빨강) / 공격(흰빛) 이미시브
  useEffect(() => {
    if (!scene) return
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        if (myShake) {
          child.material.emissive?.setHex(0xff2222)
          child.material.emissiveIntensity = 0.4
        } else if (attackAnim) {
          child.material.emissive?.setHex(0xffffff)
          child.material.emissiveIntensity = 0.3
        } else {
          child.material.emissive?.setHex(0x000000)
          child.material.emissiveIntensity = 0
        }
      }
    })
  }, [myShake, attackAnim, scene])

  return (
    <primitive
      ref={meshRef}
      object={scene}
      scale={0.78}
      position={[0, -0.3, 0]}
      rotation={[0, Math.PI * 0.15, 0]}  // 보스 방향으로 약간 회전
    />
  )
}

useGLTF.preload('/models/player.glb')
