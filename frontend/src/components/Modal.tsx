import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Modal.module.css'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** узкое окно для подтверждений */
  narrow?: boolean
}

/** Универсальное модальное окно: на телефоне выезжает снизу, на компьютере по центру. */
export function Modal({ title, onClose, children, narrow }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${narrow ? styles.narrow : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <h2>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
