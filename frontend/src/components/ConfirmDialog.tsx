import { useState } from 'react'
import type { ReactNode } from 'react'
import { errorMessage } from '../api/errors'
import { Modal } from './Modal'
import ui from './ui.module.css'

interface Props {
  title: string
  message: ReactNode
  confirmLabel: string
  /** красная кнопка для необратимых действий */
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} narrow>
      <p className={ui.muted}>{message}</p>
      {error && <p className={ui.error}>{error}</p>}
      <div className={ui.row}>
        <button type="button" className={`${ui.btn} ${ui.secondary} ${ui.small}`} onClick={onClose} disabled={busy}>
          Отмена
        </button>
        <button
          type="button"
          className={`${ui.btn} ${ui.small} ${danger ? ui.danger : ''}`}
          onClick={run}
          disabled={busy}
        >
          {busy ? 'Подождите…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
