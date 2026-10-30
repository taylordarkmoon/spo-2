import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from './Icon'
import styles from './Dropdown.module.css'

export interface DropdownOption {
  value: string
  label: string
}

interface Props {
  /** доступное имя поля (для скринридеров) */
  label: string
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  /** подпись пункта «ничего не выбрано» (value = '') */
  emptyLabel: string
  disabled?: boolean
}

/** Выпадающий список в стиле приложения (стандартный select рисует рамку и подсветку средствами браузера). */
export function Dropdown({ label, value, options, onChange, emptyLabel, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const items: DropdownOption[] = [{ value: '', label: emptyLabel }, ...options]
  const selected = items.find((o) => o.value === value) ?? items[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const openList = () => {
    setActive(Math.max(0, items.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(items.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(items[active].value)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${value ? '' : styles.placeholder}`}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={styles.text}>{selected.label}</span>
        <Icon name="chevron" size={16} className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`} />
      </button>

      {open && (
        <ul className={styles.menu} id={listId} role="listbox" aria-label={label}>
          {items.map((o, i) => (
            <li
              key={o.value || 'empty'}
              role="option"
              aria-selected={o.value === value}
              className={`${styles.option} ${i === active ? styles.active : ''} ${o.value === value ? styles.selected : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o.value)}
            >
              <span>{o.label}</span>
              {o.value === value && <Icon name="check" size={16} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
