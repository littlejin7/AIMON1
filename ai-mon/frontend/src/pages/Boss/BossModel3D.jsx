import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

export default function BossModel3D({ bossHit, bossShake, modelPath = '/models/boss_unitboss.glb', scale = 0.9, position = [0, -0.2, 0] }) {
const hasHitModel = modelPath.includes('boss_unitboss') || modelPath.includes('boss_endboss')
const hitPath = hasHitModel ? modelPath.replace('.glb', 'HIT.glb') : modelPath
const { scene: normalScene } = useGLTF(modelPath)
const { scene: hitScene } = useGLTF(hitPath)
const scene = bossHit ? hitScene : normalScene
  const meshRef = useRef()
  const shakeRef = useRef(0)


  useFrame((state) => {
    if (!meshRef.current) return

    // idle - 위아래 부유
    meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.4) * 0.05

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
        child.material.emissive?.setHex(0x000000)
        child.material.emissiveIntensity = 0
      }
    })
  }, [scene])

return (
  <primitive
    ref={meshRef}
    object={scene}
    scale={scale}
    position={position}
    rotation={[0.3, -Math.PI * 0.13, 0]}
  />
)
}

useGLTF.preload('/models/boss_unitboss.glb')
useGLTF.preload('/models/boss_endboss.glb')
useGLTF.preload('/models/boss_unitbossHIT.glb')
