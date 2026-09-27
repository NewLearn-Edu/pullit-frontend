import { getPullitNative, registerPushToken, type PushPlatform } from '@/user/api/authApi'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 앱 푸시 토큰 → 서버 동기화 (2026-09-17).
 *
 * 토큰(래퍼)과 로그인(me)이 둘 다 준비된 순간 한 번 저장한다. 순서는 어느 쪽이 먼저든 상관없다 —
 * 토큰은 window.PullitNative.pushToken 이 첫 로드엔 null 이다가 'pullit:pushToken' 이벤트로 오고,
 * me 는 화면이 useMe 를 부를 때 채워진다.
 *
 * 중복 방지는 메모리로만 한다 (앱 실행당 계정·토큰 조합마다 1회). localStorage 에 "보냈음"을 남기면
 * 서버에서 행이 지워졌을 때(로그아웃·정리 배치) 다시 올리지 못한다. 서버 등록은 멱등이라 실행마다 1회는 무해하다.
 */
let latestToken: string | null = null
let sentKey: string | null = null
let inflightKey: string | null = null
let started = false

const toPlatform = (platform: string): PushPlatform | null =>
  platform === 'android' ? 'ANDROID' : platform === 'ios' ? 'IOS' : null

function sync() {
  const native = getPullitNative()
  if (!native) return
  const token = latestToken ?? native.pushToken
  const platform = toPlatform(native.platform)
  const me = useUserStore.getState().me
  if (!token || !platform || !me) return
  const key = `${me.id}:${token}`
  if (key === sentKey || key === inflightKey) return
  inflightKey = key
  registerPushToken(token, platform)
    .then(() => {
      sentKey = key
    })
    .catch(() => {
      /* 다음 토큰 이벤트·재로그인·앱 재실행 때 다시 시도 */
    })
    .finally(() => {
      if (inflightKey === key) inflightKey = null
    })
}

export function startPushTokenSync(): void {
  if (started) return
  started = true
  window.addEventListener('pullit:pushToken', (event) => {
    const token = (event as CustomEvent<{ token?: string | null }>).detail?.token
    if (!token) return
    latestToken = token
    sync()
  })
  useUserStore.subscribe((state, prev) => {
    if (state.me?.id === prev.me?.id) return
    // 로그아웃하면 서버 행이 지워지므로, 같은 계정으로 다시 로그인해도 새로 올려야 한다
    if (!state.me) sentKey = null
    sync()
  })
  sync()
}
