import { SINGLE_FILTER } from '../config'
import type { Dictionaries, FilterKey, PostFilters } from '../types'
import { Dropdown } from './Dropdown'
import { FILTER_LABELS, filterOptions } from './FilterSheet'
import styles from './FilterPanel.module.css'

const ORDER: FilterKey[] = ['institute_id', 'subject_id', 'year', 'semester_id', 'work_type_id', 'teacher_id']

interface Props {
  dictionaries: Dictionaries | null
  value: PostFilters
  onChange: (value: PostFilters) => void
}

/** Боковая панель фильтров для компьютера (на телефоне вместо неё нижняя шторка). */
export function FilterPanel({ dictionaries, value, onChange }: Props) {
  const active = ORDER.some((k) => value[k] !== undefined)

  const set = (key: FilterKey, raw: string) => {
    if (!raw) {
      const next = { ...value }
      delete next[key]
      onChange(next)
      return
    }
    onChange(SINGLE_FILTER ? { [key]: Number(raw) } : { ...value, [key]: Number(raw) })
  }

  return (
    <section className={styles.panel} aria-label="Фильтры">
      <header className={styles.head}>
        <h2>Фильтры</h2>
        {active && (
          <button type="button" onClick={() => onChange({})}>
            Сбросить
          </button>
        )}
      </header>

      {ORDER.map((key) => (
        <div key={key} className={styles.field}>
          <span>{FILTER_LABELS[key]}</span>
          <Dropdown
            label={FILTER_LABELS[key]}
            emptyLabel="Любой"
            value={value[key] === undefined ? '' : String(value[key])}
            onChange={(v) => set(key, v)}
            disabled={!dictionaries}
            options={
              dictionaries
                ? filterOptions(dictionaries, key).map((o) => ({ value: String(o.id), label: o.label }))
                : []
            }
          />
        </div>
      ))}

      {SINGLE_FILTER && <p className={styles.note}>Одновременно действует один фильтр.</p>}
    </section>
  )
}
