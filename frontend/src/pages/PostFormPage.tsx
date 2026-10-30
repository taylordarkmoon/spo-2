import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { errorMessage } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { Dropdown } from '../components/Dropdown'
import { Icon } from '../components/Icon'
import { COMMENT_MAX } from '../config'
import { fileName, formatSize } from '../lib/format'
import { useDictionaries } from '../lib/hooks'
import type { PostFile } from '../types'
import ui from '../components/ui.module.css'
import styles from './FormPage.module.css'

const MAX_FILES = 10
const MAX_MB = 20
const MAX_TAGS = 10
const ACCEPT = 'image/*,.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.7z'
const TAG_RE = /^[A-Za-zА-Яа-яЁё0-9_.-]{1,30}$/

/** Создание нового поста и редактирование своего (маршрут /posts/:id/edit). */
export function PostFormPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : null
  const { user, loading, guestPath } = useAuth()
  const navigate = useNavigate()
  const dictionaries = useDictionaries()
  const fileRef = useRef<HTMLInputElement>(null)

  const [comment, setComment] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [existing, setExisting] = useState<PostFile[]>([])
  const [removedIds, setRemovedIds] = useState<number[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [popular, setPopular] = useState<string[]>([])
  const [ids, setIds] = useState({ institute: '', subject: '', semester: '', year: String(new Date().getFullYear()), workType: '', teacher: '' })
  const [loadingPost, setLoadingPost] = useState(editId !== null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    api.getPopularTags().then(setPopular).catch(() => setPopular([]))
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (editId === null || userId === undefined) return
    api
      .getPost(editId)
      .then((post) => {
        if (post.author.id !== userId) return setForbidden(true)
        setComment(post.comment)
        setTags(post.tags)
        setExisting(post.files)
        setIds({
          institute: String(post.institute.id),
          subject: String(post.subject.id),
          semester: String(post.semester.id),
          year: String(post.year),
          workType: String(post.work_type.id),
          teacher: post.teacher ? String(post.teacher.id) : '',
        })
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoadingPost(false))
  }, [editId, userId])

  if (loading) return null
  if (!user) return <Navigate to={guestPath} replace />
  if (forbidden) return <Navigate to="/" replace />

  const setId = (key: keyof typeof ids, value: string) => setIds((s) => ({ ...s, [key]: value }))
  const keptExisting = existing.filter((f) => !removedIds.includes(f.id))

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    for (const f of Array.from(list)) {
      if (f.size > MAX_MB * 1024 * 1024) return setError(`Файл «${f.name}» больше ${MAX_MB} МБ`)
      next.push(f)
    }
    if (next.length + keptExisting.length > MAX_FILES) return setError(`Не больше ${MAX_FILES} файлов`)
    setError(null)
    setFiles(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '').toLowerCase()
    if (!tag) return
    if (!TAG_RE.test(tag)) return setError('Тег: до 30 символов, буквы, цифры, «_», «.», «-»')
    if (tags.includes(tag)) return
    if (tags.length >= MAX_TAGS) return setError(`Не больше ${MAX_TAGS} тегов`)
    setError(null)
    setTags([...tags, tag])
  }

  const commitTag = () => {
    addTag(tagInput)
    setTagInput('')
  }

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      commitTag()
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(tags.slice(0, -1))
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (files.length + keptExisting.length === 0) return setError('Прикрепите хотя бы один файл или фото')
    if (!ids.institute || !ids.subject || !ids.semester || !ids.year || !ids.workType) {
      return setError('Выберите институт, предмет, семестр, год и тип работы')
    }
    if (comment.length > COMMENT_MAX) return setError(`Комментарий не длиннее ${COMMENT_MAX} символов`)

    // тег, который ещё набирают в поле, тоже сохраняем
    const finalTags = tagInput.trim() ? [...new Set([...tags, tagInput.trim().replace(/^#/, '').toLowerCase()])] : tags
    if (finalTags.some((t) => !TAG_RE.test(t))) return setError('Тег: до 30 символов, буквы, цифры, «_», «.», «-»')

    const fields = {
      comment: comment.trim(),
      tags: finalTags,
      year: Number(ids.year),
      institute_id: Number(ids.institute),
      subject_id: Number(ids.subject),
      semester_id: Number(ids.semester),
      work_type_id: Number(ids.workType),
      teacher_id: ids.teacher ? Number(ids.teacher) : null,
    }

    setBusy(true)
    try {
      if (editId !== null) {
        await api.updatePost(editId, { fields, removeFileIds: removedIds, newFiles: files })
        navigate('/profile', { replace: true })
      } else {
        await api.createPost({ ...fields, files })
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const options = (list: { id: number; label: string }[] | undefined) =>
    (list ?? []).map((o) => ({ value: String(o.id), label: o.label }))

  const suggestions = popular.filter((t) => !tags.includes(t)).slice(0, 8)

  return (
    <>
      <header className={styles.top}>
        <Link to={editId ? '/profile' : '/'} className={styles.back} aria-label="Назад">
          <Icon name="arrowLeft" />
        </Link>
        <h1>{editId ? 'Изменить пост' : 'Новый пост'}</h1>
      </header>

      {loadingPost ? (
        <p className={ui.muted}>Загружаем…</p>
      ) : (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.group}>
            <span className={styles.label}>Файлы и фото</span>

            {existing.length > 0 && (
              <ul className={styles.files}>
                {existing.map((f, i) => {
                  const removed = removedIds.includes(f.id)
                  return (
                    <li key={f.id} className={`${styles.fileItem} ${removed ? styles.removed : ''}`}>
                      <Icon name="file" size={18} />
                      <span>{fileName(f, i)}</span>
                      <button
                        type="button"
                        onClick={() => setRemovedIds(removed ? removedIds.filter((x) => x !== f.id) : [...removedIds, f.id])}
                        aria-label={removed ? 'Вернуть файл' : `Убрать ${fileName(f, i)}`}
                        title={removed ? 'Вернуть' : 'Убрать'}
                      >
                        <Icon name={removed ? 'plus' : 'close'} size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <button type="button" className={styles.drop} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={24} />
              <span>{editId ? 'Добавить файлы' : 'Нажмите, чтобы выбрать'}</span>
              <small>до {MAX_FILES} файлов, каждый до {MAX_MB} МБ</small>
            </button>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => addFiles(e.target.files)} />
            {files.length > 0 && (
              <ul className={styles.files}>
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className={styles.fileItem}>
                    <Icon name="file" size={18} />
                    <span>{f.name}</span>
                    <small>{formatSize(f.size)}</small>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Убрать ${f.name}`}>
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.group}>
            <label className={styles.label} htmlFor="comment">
              Комментарий
            </label>
            <textarea
              id="comment"
              className={styles.textarea}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="О чём этот материал?"
            />
            <span className={`${styles.counter} ${comment.length > COMMENT_MAX ? styles.counterOver : ''}`}>
              {comment.length}/{COMMENT_MAX}
            </span>
          </div>

          <Select label="Институт" value={ids.institute} onChange={(v) => setId('institute', v)}
            options={options(dictionaries?.institutes.map((i) => ({ id: i.id, label: i.name })))} />
          <Select label="Предмет" value={ids.subject} onChange={(v) => setId('subject', v)}
            options={options(dictionaries?.subjects.map((i) => ({ id: i.id, label: i.name })))} />
          <div className={styles.pair}>
            <Select label="Год" value={ids.year} onChange={(v) => setId('year', v)}
              options={(dictionaries?.years ?? []).map((y) => ({ value: String(y), label: String(y) }))} />
            <Select label="Семестр" value={ids.semester} onChange={(v) => setId('semester', v)}
              options={options(dictionaries?.semesters.map((i) => ({ id: i.id, label: `${i.number} семестр` })))} />
          </div>
          <Select label="Тип работы" value={ids.workType} onChange={(v) => setId('workType', v)}
            options={options(dictionaries?.work_types.map((i) => ({ id: i.id, label: i.name })))} />
          <Select label="Преподаватель (необязательно)" value={ids.teacher} onChange={(v) => setId('teacher', v)}
            options={options(dictionaries?.teachers.map((i) => ({ id: i.id, label: i.full_name })))} optional />

          <div className={styles.group}>
            <label className={styles.label} htmlFor="tags">
              Теги
            </label>
            <div className={styles.tagsBox}>
              {tags.map((t) => (
                <span key={t} className={styles.tag}>
                  #{t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Убрать тег ${t}`}>
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
              <input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKey}
                onBlur={commitTag}
                placeholder={tags.length ? '' : 'матан, интегралы…'}
              />
            </div>
            <span className={styles.hint}>Enter, пробел или запятая — добавить тег (до {MAX_TAGS})</span>
            {suggestions.length > 0 && (
              <div className={styles.suggest} aria-label="Популярные теги">
                {suggestions.map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)}>
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className={ui.error}>{error}</p>}

          <button type="submit" className={`${ui.btn} ${ui.block}`} disabled={busy}>
            {busy ? 'Сохраняем…' : editId ? 'Сохранить' : 'Опубликовать'}
          </button>
        </form>
      )}
    </>
  )
}

interface SelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  optional?: boolean
}

function Select({ label, value, onChange, options, optional }: SelectProps) {
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <Dropdown
        label={label}
        value={value}
        onChange={onChange}
        emptyLabel={optional ? 'Не указан' : 'Выберите…'}
        options={options}
      />
    </div>
  )
}
