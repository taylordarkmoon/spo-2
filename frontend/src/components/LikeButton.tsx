import { Icon } from './Icon'
import styles from './LikeButton.module.css'

interface Props {
  count: number
  liked: boolean
  /** свой пост лайкать нельзя — показываем счётчик без действия */
  readOnly?: boolean
  onToggle?: () => void
}

export function LikeButton({ count, liked, readOnly, onToggle }: Props) {
  return (
    <button
      type="button"
      className={`${styles.like} ${liked ? styles.liked : ''}`}
      onClick={onToggle}
      disabled={readOnly}
      aria-pressed={liked}
      aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'}
    >
      <Icon name="heart" size={18} filled={liked || readOnly} />
      {count}
    </button>
  )
}
