import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'
import { errorMessage } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { Field } from '../components/Field'
import { Icon } from '../components/Icon'
import ui from '../components/ui.module.css'
import styles from './FormPage.module.css'

/** Смена пароля: текущий пароль, новый и подтверждение (правила как при регистрации: 6–72 символа). */
export function ChangePasswordPage() {
  const { user, loading, guestPath, acceptSession } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (loading) return null
  if (!user) return <Navigate to={guestPath} replace />

  const errors = {
    old: oldPassword ? '' : 'Введите текущий пароль',
    new:
      newPassword.length < 6 || newPassword.length > 72
        ? 'Пароль: от 6 до 72 символов'
        : newPassword === oldPassword
          ? 'Новый пароль должен отличаться от текущего'
          : '',
    confirm: confirm === newPassword ? '' : 'Пароли не совпадают',
  }
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : '')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError(null)
    setDone(false)
    if (Object.values(errors).some(Boolean)) return
    setBusy(true)
    try {
      // старые сессии на сервере отозваны: сохраняем новую пару токенов, иначе через 15 минут нас разлогинит
      acceptSession(await api.changePassword(oldPassword, newPassword, confirm))
      setOldPassword('')
      setNewPassword('')
      setConfirm('')
      setSubmitted(false)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className={styles.top}>
        <Link to="/profile/edit" className={styles.back} aria-label="Назад">
          <Icon name="arrowLeft" />
        </Link>
        <h1>Смена пароля</h1>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field
          label="Текущий пароль"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          error={show('old')}
          autoComplete="current-password"
        />
        <Field
          label="Новый пароль"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={show('new')}
          autoComplete="new-password"
        />
        <Field
          label="Повторите новый пароль"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={show('confirm')}
          autoComplete="new-password"
        />

        {error && <p className={ui.error}>{error}</p>}
        {done && <p className={ui.success}>Пароль изменён. Вы остались в аккаунте на этом устройстве, на остальных потребуется войти заново.</p>}

        <button type="submit" className={`${ui.btn} ${ui.block}`} disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сменить пароль'}
        </button>
      </form>
    </>
  )
}
