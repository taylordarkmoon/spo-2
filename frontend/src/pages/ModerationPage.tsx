import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import { errorMessage } from '../api/errors'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import ui from '../components/ui.module.css'
import type { DictKind, Dictionaries } from '../types'
import styles from './ManagePage.module.css'

interface Entry {
  id: number
  label: string
}

const KINDS: { kind: DictKind; label: string; one: string; placeholder: string }[] = [
  { kind: 'institutes', label: 'Институты', one: 'институт', placeholder: 'Название института' },
  { kind: 'subjects', label: 'Предметы', one: 'предмет', placeholder: 'Название предмета' },
  { kind: 'semesters', label: 'Семестры', one: 'семестр', placeholder: 'Номер семестра (1–12)' },
  { kind: 'work_types', label: 'Типы работ', one: 'тип работы', placeholder: 'Например, «Реферат»' },
  { kind: 'teachers', label: 'Преподаватели', one: 'преподавателя', placeholder: 'Фамилия Имя Отчество' },
]

function entries(dict: Dictionaries, kind: DictKind): Entry[] {
  switch (kind) {
    case 'institutes':
      return dict.institutes.map((i) => ({ id: i.id, label: i.name }))
    case 'subjects':
      return dict.subjects.map((i) => ({ id: i.id, label: i.name }))
    case 'semesters':
      return dict.semesters.map((i) => ({ id: i.id, label: String(i.number) }))
    case 'work_types':
      return dict.work_types.map((i) => ({ id: i.id, label: i.name }))
    case 'teachers':
      return dict.teachers.map((i) => ({ id: i.id, label: i.full_name }))
  }
}

/** Страница модератора: пополнение и правка справочников (институты, предметы, преподаватели и т. д.). */
export function ModerationPage() {
  const [dict, setDict] = useState<Dictionaries | null>(null)
  const [kind, setKind] = useState<DictKind>('teachers')
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null)
  const [deleting, setDeleting] = useState<Entry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => api.getDictionaries().then(setDict).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => {
    reload()
  }, [reload])

  const current = KINDS.find((k) => k.kind === kind)!
  const items = dict ? entries(dict, kind) : []

  const switchKind = (next: DictKind) => {
    setKind(next)
    setValue('')
    setEditing(null)
    setError(null)
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.addDictItem(kind, value.trim())
      setValue('')
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const rename = async () => {
    if (!editing || !editing.value.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.renameDictItem(kind, editing.id, editing.value.trim())
      setEditing(null)
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className={styles.head}>
        <h1>Модерация</h1>
        <p>Пополняйте справочники: они используются в фильтрах и при создании постов. Удалять посты и выдавать предупреждения можно прямо в ленте (кнопка со щитом).</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Справочники">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="tab"
            aria-selected={kind === k.kind}
            className={`${styles.tab} ${kind === k.kind ? styles.tabActive : ''}`}
            onClick={() => switchKind(k.kind)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <section className={styles.panel}>
        <form className={styles.addRow} onSubmit={add}>
          <input
            className={styles.input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type={kind === 'semesters' ? 'number' : 'text'}
            min={1}
            max={12}
            placeholder={current.placeholder}
            aria-label={`Новый ${current.one}`}
          />
          <button type="submit" className={`${ui.btn} ${ui.small}`} disabled={busy || !value.trim()}>
            <Icon name="plus" size={16} /> Добавить
          </button>
        </form>

        {error && <p className={ui.error}>{error}</p>}

        {!dict && <p className={ui.muted}>Загружаем…</p>}
        <ul className={styles.items}>
          {items.map((it) => (
            <li key={it.id} className={styles.item}>
              {editing?.id === it.id ? (
                <>
                  <input
                    className={styles.input}
                    value={editing.value}
                    onChange={(e) => setEditing({ id: it.id, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    type={kind === 'semesters' ? 'number' : 'text'}
                    autoFocus
                    aria-label="Новое значение"
                  />
                  <button type="button" className={`${ui.btn} ${ui.small}`} onClick={rename} disabled={busy}>
                    Сохранить
                  </button>
                  <button type="button" className={`${ui.btn} ${ui.secondary} ${ui.small}`} onClick={() => setEditing(null)}>
                    Отмена
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.itemText}>{kind === 'semesters' ? `${it.label} семестр` : it.label}</span>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => setEditing({ id: it.id, value: it.label })}
                    aria-label={`Переименовать «${it.label}»`}
                    title="Переименовать"
                  >
                    <Icon name="pencil" size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconDanger}`}
                    onClick={() => setDeleting(it)}
                    aria-label={`Удалить «${it.label}»`}
                    title="Удалить"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </>
              )}
            </li>
          ))}
          {dict && items.length === 0 && <li className={ui.muted}>В справочнике пока пусто</li>}
        </ul>
      </section>

      {deleting && (
        <ConfirmDialog
          title="Удалить значение?"
          message={`«${deleting.label}» будет удалено из справочника. Если значение уже используется в постах, удалить его нельзя, но можно переименовать.`}
          confirmLabel="Удалить"
          danger
          onConfirm={async () => {
            await api.deleteDictItem(kind, deleting.id)
            await reload()
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
