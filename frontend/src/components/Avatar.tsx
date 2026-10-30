import { initials, mediaUrl } from '../lib/format'
import styles from './Avatar.module.css'

const TONES = ['violet', 'lime', 'sky', 'rose'] as const

function tone(nickname: string): (typeof TONES)[number] {
  let h = 0
  for (const ch of nickname) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length]
}

interface Props {
  nickname: string
  url?: string | null
  size?: number
}

export function Avatar({ nickname, url, size = 28 }: Props) {
  const src = mediaUrl(url)
  return (
    <span
      className={`${styles.avatar} ${styles[tone(nickname)]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : initials(nickname)}
    </span>
  )
}
