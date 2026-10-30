import { Link } from 'react-router-dom'
import { APP_NAME } from '../config'
import { Icon } from './Icon'
import styles from './Logo.module.css'

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <Link to="/" className={`${styles.logo} ${size === 'lg' ? styles.lg : ''}`} aria-label={APP_NAME}>
      <span className={styles.mark}>
        <Icon name="check" size={size === 'lg' ? 22 : 18} />
      </span>
      <span className={styles.name}>{APP_NAME}</span>
    </Link>
  )
}
