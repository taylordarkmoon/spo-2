import { useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Icon } from './Icon'
import styles from './Field.module.css'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Field({ label, error, type, ...rest }: Props) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          className={`${styles.input} ${error ? styles.invalid : ''}`}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.eye}
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
          >
            <Icon name={shown ? 'eye' : 'eyeOff'} />
          </button>
        )}
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
