import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import clsx from 'clsx'

const ToastContext = createContext<(msg: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

/** 어드민 공용 토스트 — 하단 중앙에 2.4초 표시 후 사라짐 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('')
  const [show, setShow] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const toast = useCallback((m: string) => {
    setMsg(m)
    setShow(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShow(false), 2400)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={clsx('toast', show && 'show')}>
        <span className="dot" />
        <span>{msg}</span>
      </div>
    </ToastContext.Provider>
  )
}
