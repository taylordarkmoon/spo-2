import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { Field } from '../components/Field'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import ui from '../components/ui.module.css'
import styles from './AuthPage.module.css'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Введите почту и пароль')
      return
    }
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className={styles.top}>
        <Logo />
        <Link to="/register" className={styles.link}>
          Регистрация <Icon name="arrowUpRight" size={14} />
        </Link>
      </header>

      <div className={`${styles.panel} ${styles.solo}`}>
      <h1 className={styles.title}>С возвращением</h1>
      <p className={styles.lead}>Войдите по почте и паролю.</p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field
          label="Электронная почта"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="name@mail.ru"
          testId="login-email"
        />
        <Field
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          testId="login-password"
        />

        {error && <p className={ui.error}>{error}</p>}

        <button type="submit" className={`${ui.btn} ${ui.block}`} disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
          {!busy && <Icon name="arrowRight" size={18} />}
        </button>
      </form>

      <div className={styles.guest}>
        <Link to="/">Просто посмотреть</Link>
        <span>Лента доступна без регистрации!</span>
      </div>
      </div>
    </>
  )
}
