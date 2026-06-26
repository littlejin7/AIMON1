import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

export default function BossModel3D({ bossHit, bossShake }) {
  const { scene } = useGLTF('/models/boss.glb')
  const meshRef = useRef()
  const shakeRef = useRef(0)

  useFrame((state) => {
    if (!meshRef.current) return

    // idle - 위아래 부유
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.4) * 0.05

    // 피격 시 좌우 흔들림
    if (bossShake) {
      shakeRef.current += 1
      meshRef.current.position.x = Math.sin(shakeRef.current * 0.8) * 0.12
    } else {
      meshRef.current.position.x *= 0.85
      if (Math.abs(meshRef.current.position.x) < 0.001) {
        meshRef.current.position.x = 0
        shakeRef.current = 0
      }
    }
  })

  useEffect(() => {
    if (!scene) return
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissive?.setHex(bossHit ? 0xff2222 : 0x000000)
        child.material.emissiveIntensity = bossHit ? 0.5 : 0
      }
    })
  }, [bossHit, scene])

  return (
    <primitive
      ref={meshRef}
      object={scene}
      scale={0.78}
      position={[0, -0.3, 0]}
      rotation={[0, -Math.PI * 0.15, 0]}  // 플레이어 방향(왼쪽)으로 회전
    />
  )
}

useGLTF.preload('/models/boss.glb')
