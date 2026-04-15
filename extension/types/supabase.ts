// Type declarations for Supabase Realtime in extension
// Using loose typing since we don't have the full DB schema types

export type RealtimeCallback = (payload: {
  new: any;
  old: any;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
}) => void;

export interface RealtimeChannel {
  on(
    event: 'postgres_changes',
    config: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
      schema: string;
      table: string;
      filter?: string;
    },
    callback: RealtimeCallback
  ): RealtimeChannel;
  subscribe(): RealtimeChannel;
  unsubscribe(): Promise<{ error: Error | null }>;
}

// Loose Supabase client type for extension use
export interface SupabaseClient {
  from(table: string): {
    select(columns: string, options?: { count?: 'exact' | 'planned' | 'estimated' }): any;
    select(columns?: string): any;
    insert(values: any[], options?: { ignoreDuplicates?: boolean }): any;
    upsert(values: any[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): any;
    update(values: any): any;
    delete(): any;
    eq(column: string, value: any): any;
    neq(column: string, value: any): any;
    gt(column: string, value: any): any;
    gte(column: string, value: any): any;
    lt(column: string, value: any): any;
    lte(column: string, value: any): any;
    like(column: string, pattern: string): any;
    ilike(column: string, pattern: string): any;
    is(column: string, value: any): any;
    in(column: string, values: any[]): any;
    contains(column: string, value: any): any;
    containedBy(column: string, value: any): any;
    range(column: string, from: number, to: number): any;
    match(query: Record<string, any>): any;
    not(column: string, operator: string, value: any): any;
    or(filters: string): any;
    and(filters: string): any;
    filter(column: string, operator: string, value: any): any;
    order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): any;
    limit(count: number): any;
    single(): any;
    maybeSingle(): any;
    csv(): any;
    then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
  };
  channel(name: string): RealtimeChannel;
  removeChannel(channel: RealtimeChannel): void;
}
