import { useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../api/errors'
import { WARNINGS_TO_BAN } from '../config'
import type { Post } from '../types'
import { Modal } from './Modal'
import ui from './ui.module.css'
import styles from './ModerationDialog.module.css'

/** Лимит текста предупреждения при удалении поста на бэкенде (ModerationDeleteIn.comment). */
const COMMENT_MAX_WARNING = 450

interface Props {
  post: Post
  /** вызывается при закрытии окна, если пост был удалён */
  onRemoved: (post: Post) => void
  onClose: () => void
}

export function ModerationDialog({ post, onRemoved, onClose }: Props) {
  const [violation, setViolation] = useState(false)
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'delete' | 'warn' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<string | null>(null)
  const [warned, setWarned] = useState<string | null>(null)

  const close = () => {
    onClose()
    if (deleted) onRemoved(post)
  }

  const remove = async () => {
    if (violation && !comment.trim()) return setError('Напишите текст предупреждения: он будет отправлен автору')
    setBusy('delete')
    setError(null)
    try {
      const res = await api.moderatorDeletePost(post.id, violation, comment)
      let text = 'Пост удалён.'
      if (res.warning_issued) {
        text += ` Автору выдано предупреждение (${res.warnings_count} из ${WARNINGS_TO_BAN}).`
        if (res.auto_banned) text += ' Автор заблокирован автоматически.'
      }
      setDeleted(text)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const warn = async () => {
    if (!reason.trim()) return setError('Укажите причину предупреждения')
    setBusy('warn')
    setError(null)
    try {
      const res = await api.warnUser(post.author.id, reason.trim())
      setWarned(
        `Предупреждение выдано (${res.warnings_count} из ${WARNINGS_TO_BAN}).` +
          (res.auto_banned ? ' Автор заблокирован автоматически.' : ''),
      )
      setReason('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (deleted) {
    return (
      <Modal title="Модерация" onClose={close} narrow>
        <p className={ui.success}>{deleted}</p>
        <div className={ui.row}>
          <button type="button" className={`${ui.btn} ${ui.small}`} onClick={close}>
            Готово
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Модерация поста" onClose={close}>
      <p className={ui.muted}>
        «{post.subject.name}» · автор <strong>{post.display_nickname}</strong>
      </p>

      <section className={styles.block}>
        <h3>Удалить пост</h3>
        <label className={styles.check}>
          <input type="checkbox" checked={violation} onChange={(e) => setViolation(e.target.checked)} />
          <span>Нарушает правила (автор получит предупреждение)</span>
        </label>
        {violation ? (
          <textarea
            className={styles.textarea}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={COMMENT_MAX_WARNING}
            placeholder="Текст предупреждения автору (обязательно)"
            aria-label="Текст предупреждения автору"
          />
        ) : (
          <p className={styles.hint}>Без отметки пост будет просто удалён, автор не получит предупреждения.</p>
        )}
        <button type="button" className={`${ui.btn} ${ui.danger} ${ui.small}`} onClick={remove} disabled={busy !== null}>
          {busy === 'delete' ? 'Удаляем…' : 'Удалить пост'}
        </button>
      </section>

      <section className={styles.block}>
        <h3>Предупреждение автору</h3>
        <input
          className={styles.input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Причина предупреждения"
          aria-label="Причина предупреждения"
        />
        {warned && <p className={ui.success}>{warned}</p>}
        <button type="button" className={`${ui.btn} ${ui.secondary} ${ui.small}`} onClick={warn} disabled={busy !== null}>
          {busy === 'warn' ? 'Отправляем…' : 'Выдать предупреждение'}
        </button>
        <p className={styles.hint}>После {WARNINGS_TO_BAN} предупреждений пользователь блокируется автоматически.</p>
      </section>

      {error && <p className={ui.error}>{error}</p>}
    </Modal>
  )
}
