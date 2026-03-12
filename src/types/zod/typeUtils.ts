export type NormalizeNullable<T> =
    T extends null ? undefined :
    T extends (infer U)[] ? NormalizeNullable<U>[] :
    T extends object ? { [K in keyof T]: NormalizeNullable<T[K]> } :
    T;