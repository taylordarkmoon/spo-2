import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { errorMessage } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/Avatar'
import { Field } from '../components/Field'
import { Icon } from '../components/Icon'
import ui from '../components/ui.module.css'
import styles from './FormPage.module.css'

const NICK_RE = /^[A-Za-zА-Яа-яЁё0-9_.-]{3,32}$/

export function EditProfilePage() {
  const { user, loading, setUser, logout, guestPath } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [avatar, setAvatar] = useState<File | null | undefined>(undefined)
  const [preview, setPreview] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return null
  if (!user) return <Navigate to={guestPath} replace />

  const shownAvatar = preview === undefined ? user.avatar_url : preview

  const pickFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return setError('Аватарка должна быть не больше 5 МБ')
    setError(null)
    setAvatar(file)
    setPreview(URL.createObjectURL(file))
  }

  const removeAvatar = () => {
    setAvatar(null)
    setPreview(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!NICK_RE.test(nickname.trim())) {
      return setError('Никнейм: 3–32 символа, буквы, цифры, «_», «.», «-»')
    }
    setBusy(true)
    try {
      const updated = await api.updateMe({
        nickname: nickname.trim() !== user.nickname ? nickname.trim() : undefined,
        avatar,
      })
      setUser(updated)
      navigate('/profile')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className={styles.top}>
        <Link to="/profile" className={styles.back} aria-label="Назад">
          <Icon name="arrowLeft" />
        </Link>
        <h1>Редактировать профиль</h1>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.avatarBlock}>
          <Avatar nickname={nickname || user.nickname} url={shownAvatar} size={88} />
          <div className={styles.avatarActions}>
            <button type="button" className={`${ui.btn} ${ui.secondary} ${ui.small}`} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Загрузить фото
            </button>
            {shownAvatar && (
              <button type="button" className={styles.linkDanger} onClick={removeAvatar}>
                Удалить фото
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        <Field label="Никнейм" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="username" />

        {error && <p className={ui.error}>{error}</p>}

        <button type="submit" className={`${ui.btn} ${ui.block}`} disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button
          type="button"
          className={`${ui.btn} ${ui.secondary} ${ui.block}`}
          onClick={() => {
            logout()
            navigate('/')
          }}
        >
          <Icon name="logout" size={18} /> Выйти из аккаунта
        </button>
      </form>
    </>
  )
}
