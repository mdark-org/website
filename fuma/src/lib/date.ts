import * as parser from 'any-date-parser'

/** Lenient date parsing shared by list / item components. */
export const parserAsDate = <T = null>(x: Date | string | undefined | null, fallback: T | null = null): Date | T => {
  if (typeof x === 'string') {
    return parser.fromString(x)
  }
  if (x === undefined || x === null) return fallback ?? (new Date(0) as T)
  return x
}
