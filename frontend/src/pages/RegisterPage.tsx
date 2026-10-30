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

const NICK_RE = /^[A-Za-zА-Яа-яЁё0-9_.-]{3,32}$/

export function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()

  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  if (user) return <Navigate to="/" replace />

  const errors = {
    nickname: NICK_RE.test(nickname.trim()) ? '' : 'Никнейм: 3–32 символа, буквы, цифры, «_», «.», «-»',
    email: /^\S+@\S+\.\S+$/.test(email.trim()) ? '' : 'Введите корректную почту',
    password: password.length >= 6 && password.length <= 72 ? '' : 'Пароль: от 6 до 72 символов',
    confirm: confirm === password ? '' : 'Пароли не совпадают',
    agree: agree ? '' : 'Нужно принять условия',
  }
  const invalid = Object.values(errors).some(Boolean)
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : '')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (invalid) return
    setBusy(true)
    try {
      await register({
        email: email.trim(),
        nickname: nickname.trim(),
        password,
        password_confirm: confirm,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setServerError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className={styles.top}>
        <Logo />
        <Link to="/login" className={styles.link}>
          Войти <Icon name="arrowUpRight" size={14} />
        </Link>
      </header>

      <div className={styles.layout}>
      <section className={styles.hero}>
        <div>
          <h2>
            Твои знания.
            <br />
            Чей-то зачёт.
          </h2>
          <p>Конспекты и шпаргалки, которые выручают.</p>
        </div>
        <div className={styles.note} aria-hidden="true">
          КОНСПЕКТ
          <strong>Σ x²</strong>
          <span className={styles.ok}>
            <Icon name="check" size={18} />
          </span>
        </div>
      </section>

      <div className={styles.panel}>
      <h1 className={styles.title}>Создать аккаунт</h1>
      <p className={styles.lead}>Делись знаниями. Готовься вместе.</p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field
          label="Никнейм"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          error={show('nickname')}
          autoComplete="username"
          placeholder="Как вас будут видеть другие"
        />
        <Field
          label="Электронная почта"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={show('email')}
          autoComplete="email"
          placeholder="name@mail.ru"
        />
        <Field
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={show('password')}
          autoComplete="new-password"
        />
        <Field
          label="Повторите пароль"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={show('confirm')}
          autoComplete="new-password"
        />

        <div>
          <label className={styles.agree}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span className={styles.box}>
              <Icon name="check" size={14} />
            </span>
            <span>
              Принимаю <a href="#terms">условия использования</a> и <a href="#privacy">политику конфиденциальности</a>
            </span>
          </label>
          {show('agree') && <p className={ui.error}>{show('agree')}</p>}
        </div>

        {serverError && <p className={ui.error}>{serverError}</p>}

        <button type="submit" className={`${ui.btn} ${ui.block}`} disabled={busy}>
          {busy ? 'Создаём…' : 'Зарегистрироваться'}
          {!busy && <Icon name="arrowRight" size={18} />}
        </button>
      </form>

      <div className={styles.guest}>
        <Link to="/">Просто посмотреть</Link>
        <span>Лента доступна без регистрации!</span>
      </div>
      </div>
      </div>
    </>
  )
}
