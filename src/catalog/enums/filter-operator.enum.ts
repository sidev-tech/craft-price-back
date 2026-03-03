export enum FilterOperator {
  /** Точний збіг */
  EQ = 'eq',
  /** Не дорівнює */
  NEQ = 'neq',
  /** Містить підрядок (без урахування регістру) */
  CONTAINS = 'contains',
  /** Не містить підрядок */
  NOT_CONTAINS = 'not_contains',
  /** Входить у список значень (для select-колонок) */
  IN = 'in',
  /** Не входить у список значень */
  NOT_IN = 'not_in',
  /** Більше або рівне (min) */
  GTE = 'gte',
  /** Менше або рівне (max) */
  LTE = 'lte',
  /** Строго більше */
  GT = 'gt',
  /** Строго менше */
  LT = 'lt',
  /** Поле порожнє / відсутнє */
  IS_NULL = 'is_null',
  /** Поле заповнене */
  IS_NOT_NULL = 'is_not_null',
}
