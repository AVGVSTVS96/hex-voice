interface Array<T> {
  findLast: {
    <S extends T>(predicate: (value: T, index: number, array: T[]) => value is S): S | undefined;
    (predicate: (value: T, index: number, array: T[]) => boolean): T | undefined;
  };
  findLastIndex: (predicate: (value: T, index: number, array: T[]) => boolean) => number;
  toReversed: () => T[];
  toSpliced: (start: number, deleteCount?: number, ...items: T[]) => T[];
  with: (index: number, value: T) => T[];
}

interface ReadonlyArray<T> {
  findLast: {
    <S extends T>(
      predicate: (value: T, index: number, array: readonly T[]) => value is S,
    ): S | undefined;
    (predicate: (value: T, index: number, array: readonly T[]) => boolean): T | undefined;
  };
  findLastIndex: (predicate: (value: T, index: number, array: readonly T[]) => boolean) => number;
  toReversed: () => T[];
  toSpliced: (start: number, deleteCount?: number, ...items: T[]) => T[];
  with: (index: number, value: T) => T[];
}
