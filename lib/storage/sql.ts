export type SqlValue = string | number | null;
export interface SqlDatabase {
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<number>;
}
