import { useEffect, useMemo, useState } from 'react';
import { SINGLE_FILTER } from '../config';
import type { Dictionaries, FilterKey, PostFilters } from '../types';
import { Icon } from './Icon';
import styles from './FilterSheet.module.css';

export const FILTER_LABELS: Record<FilterKey, string> = {
  institute_id: 'Институт',
  subject_id: 'Предмет',
  year: 'Год',
  semester_id: 'Семестр',
  work_type_id: 'Тип работы',
  teacher_id: 'Преподаватель',
};

const ORDER: FilterKey[] = [
  'institute_id',
  'subject_id',
  'year',
  'semester_id',
  'work_type_id',
  'teacher_id',
];

interface Option {
  id: number;
  label: string;
}

export function filterOptions(dict: Dictionaries, key: FilterKey): Option[] {
  switch (key) {
    case 'institute_id':
      return dict.institutes.map((i) => ({ id: i.id, label: i.name }));
    case 'subject_id':
      return dict.subjects.map((i) => ({ id: i.id, label: i.name }));
    // case 'year':
    //   return dict.years.map((y) => ({ id: y, label: String(y) }))
    case 'semester_id':
      return dict.semesters.map((i) => ({
        id: i.id,
        label: `${i.number} семестр`,
      }));
    case 'work_type_id':
      return dict.work_types.map((i) => ({ id: i.id, label: i.name }));
    case 'teacher_id':
      return dict.teachers.map((i) => ({ id: i.id, label: i.full_name }));
  }
}

export function filterValueLabel(
  dict: Dictionaries,
  key: FilterKey,
  id: number,
): string {
  return filterOptions(dict, key).find((o) => o.id === id)?.label ?? '—';
}

interface Props {
  open: boolean;
  dictionaries: Dictionaries | null;
  value: PostFilters;
  onChange: (value: PostFilters) => void;
  onClose: () => void;
}

export function FilterSheet({
  open,
  dictionaries,
  value,
  onChange,
  onClose,
}: Props) {
  const [category, setCategory] = useState<FilterKey | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const options = useMemo(() => {
    if (!dictionaries || !category) return [];
    const needle = search.trim().toLowerCase();
    return filterOptions(dictionaries, category).filter((o) =>
      o.label.toLowerCase().includes(needle),
    );
  }, [dictionaries, category, search]);

  if (!open) return null;

  const close = () => {
    setCategory(null);
    setSearch('');
    onClose();
  };

  const pick = (key: FilterKey, id: number) => {
    onChange(SINGLE_FILTER ? { [key]: id } : { ...value, [key]: id });
    if (SINGLE_FILTER) return close();
    // при множественной фильтрации остаёмся в шторке, чтобы выбрать следующий фильтр
    setCategory(null);
    setSearch('');
  };

  const clear = (key: FilterKey) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  return (
    <div className={styles.overlay} onClick={close}>
      <div
        className={styles.sheet}
        role='dialog'
        aria-modal='true'
        aria-label='Фильтры'
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          {category ? (
            <button
              type='button'
              className={styles.icon}
              onClick={() => setCategory(null)}
              aria-label='Назад'
            >
              <Icon name='arrowLeft' />
            </button>
          ) : (
            <span className={styles.icon} />
          )}
          <h2 className={styles.title}>
            {category ? FILTER_LABELS[category] : 'Фильтры'}
          </h2>
          <button
            type='button'
            className={styles.icon}
            onClick={close}
            aria-label='Закрыть'
          >
            <Icon name='close' />
          </button>
        </header>

        {!dictionaries && (
          <p className={styles.empty}>Загружаем справочники…</p>
        )}

        {dictionaries && !category && (
          <ul className={styles.list}>
            {ORDER.map((key) => {
              const current = value[key];
              return (
                <li key={key}>
                  <button
                    type='button'
                    className={styles.item}
                    onClick={() => setCategory(key)}
                  >
                    <span>{FILTER_LABELS[key]}</span>
                    <span className={styles.current}>
                      {current !== undefined
                        ? filterValueLabel(dictionaries, key, current)
                        : 'Любой'}
                    </span>
                    <Icon name='chevron' size={16} />
                  </button>
                  {current !== undefined && (
                    <button
                      type='button'
                      className={styles.reset}
                      onClick={() => clear(key)}
                    >
                      Сбросить
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {dictionaries && category && (
          <>
            <div className={styles.search}>
              <Icon name='search' size={16} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Найти значение'
                aria-label='Поиск по значениям'
              />
            </div>
            <ul className={styles.list}>
              {options.map((o) => (
                <li key={o.id}>
                  <button
                    type='button'
                    className={`${styles.item} ${value[category] === o.id ? styles.selected : ''}`}
                    onClick={() => pick(category, o.id)}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
              {options.length === 0 && (
                <li className={styles.empty}>Ничего не найдено</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
