import { useEffect, useRef, useState } from 'react'
import { authApi } from '../../../api/index'

const EMPTY_OTP = ['', '', '', '', '', '']

export function useEmailVerification({ email, isValidEmail, onVerified, onError, purpose = 'register' }) {
  const [otp, setOtp] = useState(EMPTY_OTP)
  const [codeSending, setCodeSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [verified, setVerified] = useState(false)
  const [message, setMessage] = useState('')
  const [resendRemaining, setResendRemaining] = useState(0)
  const [codeExpiresIn, setCodeExpiresIn] = useState(0)
  const otpRefs = useRef([])

  const otpFilled = otp.every(Boolean)

  useEffect(() => {
    if (resendRemaining <= 0) return undefined
    const timer = window.setInterval(() => {
      setResendRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendRemaining])

  useEffect(() => {
    if (codeExpiresIn <= 0) return undefined
    const timer = window.setInterval(() => {
      setCodeExpiresIn((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [codeExpiresIn])

  const reset = () => {
    setOtp(EMPTY_OTP)
    setCodeSent(false)
    setVerified(false)
    setMessage('')
    setResendRemaining(0)
    setCodeExpiresIn(0)
  }

  const sendCode = async () => {
    if (!isValidEmail || codeSending || resendRemaining > 0) return
    setCodeSending(true)
    setMessage('')
    onError?.('')
    try {
      const res = await authApi.sendEmailCode({ email: email.trim(), purpose })
      setCodeSent(true)
      setVerified(false)
      setOtp(EMPTY_OTP)
      setMessage(res.data?.message || '인증코드를 발송했습니다. 메일함과 스팸함을 확인해주세요.')
      setResendRemaining(res.data?.cooldown_seconds || 60)
      setCodeExpiresIn(res.data?.ttl_seconds || 300)
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      const nextMessage = status >= 500
        ? (detail || '서버 이메일 발송 설정을 확인해야 합니다. 관리자에게 문의해주세요.')
        : (detail || '인증코드 발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
      setMessage(nextMessage)
      onError?.(nextMessage)
    } finally {
      setCodeSending(false)
    }
  }

  const verifyCode = async () => {
    if (!otpFilled || verifying || !codeSent) return
    setVerifying(true)
    setMessage('')
    onError?.('')
    try {
      await authApi.verifyEmailCode({
        email: email.trim(),
        code: otp.join(''),
        purpose,
      })
      setVerified(true)
      setMessage('이메일 인증이 완료되었습니다.')
      onVerified?.()
    } catch (err) {
      const nextMessage = err.response?.data?.detail || '코드가 일치하지 않거나 만료되었습니다.'
      setVerified(false)
      setMessage('코드가 일치하지 않거나 만료되었습니다.')
      onError?.(nextMessage)
    } finally {
      setVerifying(false)
    }
  }

  const handleOtpChange = (index, value) => {
    const nextValue = value.replace(/\D/g, '').slice(-1)
    const nextOtp = [...otp]
    nextOtp[index] = nextValue
    setOtp(nextOtp)
    if (nextValue && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  return {
    otp,
    otpRefs,
    otpFilled,
    codeSending,
    verifying,
    codeSent,
    verified,
    message,
    resendRemaining,
    codeExpiresIn,
    reset,
    sendCode,
    verifyCode,
    handleOtpChange,
    handleOtpKeyDown,
  }
}
