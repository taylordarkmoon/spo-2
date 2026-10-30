import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../api/errors'
import { PAGE_SIZE } from '../config'
import type { Dictionaries, Post, PostFilters, SortMode } from '../types'

export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function useDictionaries(): Dictionaries | null {
  const [dict, setDict] = useState<Dictionaries | null>(null)
  useEffect(() => {
    api.getDictionaries().then(setDict).catch(() => setDict(null))
  }, [])
  return dict
}

interface FeedParams {
  sort: SortMode
  q: string
  filters: PostFilters
}

/** Лента с пагинацией «ещё»: первая страница при смене параметров, затем подгрузка по offset. */
export function usePostFeed({ sort, q, filters }: FeedParams) {
  const [items, setItems] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    api
      .getPosts({ ...filters, sort, q, limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (id !== requestId.current) return
        setItems(page.items)
        setTotal(page.total)
        setHasMore(page.has_more)
      })
      .catch((e) => id === requestId.current && setError(errorMessage(e)))
      .finally(() => id === requestId.current && setLoading(false))
    // filters сравниваем по сериализованному значению, чтобы не перезапрашивать на каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, q, filtersKey])

  const loadMore = useCallback(() => {
    const id = requestId.current
    setLoadingMore(true)
    api
      .getPosts({ ...filters, sort, q, limit: PAGE_SIZE, offset: items.length })
      .then((page) => {
        if (id !== requestId.current) return
        setItems((prev) => [...prev, ...page.items])
        setTotal(page.total)
        setHasMore(page.has_more)
      })
      .catch((e) => id === requestId.current && setError(errorMessage(e)))
      .finally(() => setLoadingMore(false))
  }, [filters, sort, q, items.length])

  const patch = useCallback((postId: number, changes: Partial<Post>) => {
    setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, ...changes } : p)))
  }, [])

  const remove = useCallback((postId: number) => {
    setItems((prev) => prev.filter((p) => p.id !== postId))
    setTotal((t) => Math.max(0, t - 1))
  }, [])

  return { items, total, hasMore, loading, loadingMore, error, loadMore, patch, remove }
}
