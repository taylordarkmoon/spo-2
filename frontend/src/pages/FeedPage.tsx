import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import { FilterPanel } from '../components/FilterPanel'
import { FilterSheet, FILTER_LABELS, filterValueLabel } from '../components/FilterSheet'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { PostCard } from '../components/PostCard'
import { useDebounced, useDictionaries, usePostFeed } from '../lib/hooks'
import { plural } from '../lib/format'
import type { FilterKey, Post, PostFilters, SortMode } from '../types'
import ui from '../components/ui.module.css'
import styles from './FeedPage.module.css'

export function FeedPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const dictionaries = useDictionaries()

  const [sort, setSort] = useState<SortMode>('new')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<PostFilters>({})
  const [sheetOpen, setSheetOpen] = useState(false)

  const q = useDebounced(query)
  const feed = usePostFeed({ sort, q, filters })

  const activeFilters = (Object.keys(filters) as FilterKey[]).filter((k) => filters[k] !== undefined)

  const toggleLike = async (post: Post) => {
    if (!user) return navigate('/login')
    const want = !post.is_liked
    feed.patch(post.id, { is_liked: want, likes_count: post.likes_count + (want ? 1 : -1) })
    try {
      const res = await api.setLike(post.id, want)
      feed.patch(post.id, { is_liked: res.liked, likes_count: res.likes_count })
    } catch {
      feed.patch(post.id, { is_liked: post.is_liked, likes_count: post.likes_count })
    }
  }

  const removeFilter = (key: FilterKey) => {
    const next = { ...filters }
    delete next[key]
    setFilters(next)
  }

  return (
    <>
      <header className={styles.top}>
        <Logo />
        {user ? (
          <Link to="/posts/new" className={`${ui.btn} ${ui.small}`}>
            <Icon name="plus" size={18} />
            Выложить
          </Link>
        ) : (
          <Link to="/login" className={`${ui.btn} ${ui.small}`}>
            Войти
          </Link>
        )}
      </header>

      <div className={styles.intro}>
        <div>
          <h1 className={styles.heading}>Знания ближе.</h1>
          <p className={styles.sub}>От студентов — для студентов</p>
        </div>

        <div className={styles.searchRow}>
        <label className={styles.search}>
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по автору или тегам"
            aria-label="Поиск"
          />
        </label>
        </div>
      </div>

      <div className={styles.filterRow}>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeFilters.length ? styles.filterOn : ''}`}
          onClick={() => setSheetOpen(true)}
          aria-label="Фильтры"
        >
          <Icon name="sliders" />
        </button>
        {dictionaries &&
          activeFilters.map((key) => (
            <span key={key} className={styles.chip}>
              {FILTER_LABELS[key]}: {filterValueLabel(dictionaries, key, filters[key]!)}
              <button type="button" onClick={() => removeFilter(key)} aria-label="Убрать фильтр">
                <Icon name="close" size={14} />
              </button>
            </span>
          ))}
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <FilterPanel dictionaries={dictionaries} value={filters} onChange={setFilters} />
        </aside>

        <div className={styles.content}>
      <div className={styles.bar}>
        <span className={styles.count}>
          {feed.loading ? ' ' : `${feed.total} ${plural(feed.total, 'материал', 'материала', 'материалов')}`}
        </span>
        <div className={styles.segment} role="group" aria-label="Сортировка">
          <button type="button" className={sort === 'new' ? styles.on : ''} onClick={() => setSort('new')}>
            Сначала новые
          </button>
          <button type="button" className={sort === 'rating' ? styles.on : ''} onClick={() => setSort('rating')}>
            По рейтингу
          </button>
        </div>
      </div>

      {feed.error && <p className={ui.error}>{feed.error}</p>}

      <div className={styles.list}>
        {feed.items.map((post) => (
          <PostCard key={post.id} post={post} onLike={toggleLike} onRemoved={(p) => feed.remove(p.id)} />
        ))}
      </div>

      {feed.loading && <p className={styles.state}>Загружаем…</p>}
      {!feed.loading && feed.items.length === 0 && !feed.error && (
        <p className={styles.state}>Ничего не найдено. Попробуйте изменить поиск или фильтры.</p>
      )}

      {feed.hasMore && (
        <button
          type="button"
          className={`${ui.btn} ${ui.secondary} ${ui.block} ${styles.more}`}
          onClick={feed.loadMore}
          disabled={feed.loadingMore}
        >
          {feed.loadingMore ? 'Загружаем…' : 'Показать ещё'}
        </button>
      )}

        </div>
      </div>

      <FilterSheet
        open={sheetOpen}
        dictionaries={dictionaries}
        value={filters}
        onChange={setFilters}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
