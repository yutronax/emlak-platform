import { randomUUID } from "node:crypto";
import { vi, type Mock } from "vitest";
import type { createClient } from "@/lib/supabase/server";

type Spy = Mock<(...args: unknown[]) => unknown>;

/**
 * Test amaçlı, bellek içi Supabase istemci sahtesi.
 * Gerçek DB'ye bağlanmaz. Yalnızca test dosyalarında kullanılır
 * (`*.test.ts` dosyaları tarafından; Vitest bu dosyanın kendisini çalıştırmaz).
 *
 * Desteklenen yüzey: auth.getUser, from(table).select/insert/update/eq/single/maybeSingle
 * ve await edilebilir sorgu sonucu. Her mutasyon çağrısı (insert/update) bir vi.fn
 * spy'ına kaydedilir; böylece "çağrılmadı" iddiaları doğrudan assert edilebilir.
 */

export type Row = Record<string, unknown>;

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface QueryLog {
  table: string;
  op: "select" | "insert" | "update";
  filters: Record<string, unknown>;
  payload: Row | null;
}

export interface FakeResult {
  data: unknown;
  error: unknown;
}

export interface FakeSupabaseOptions {
  user?: { id: string } | null;
  tables?: Record<string, Row[]>;
  /** Tablo başına benzersiz kolon. Aynı değerle insert edilirse 23505 hatası döner. */
  uniqueColumns?: Record<string, string>;
}

interface FakeContext {
  user: { id: string } | null;
  tables: Record<string, Row[]>;
  uniqueColumns: Record<string, string>;
  queries: QueryLog[];
  updateError: Error | null;
  insertSpy: Spy;
  updateSpy: Spy;
}

class FakeQuery implements PromiseLike<FakeResult> {
  private op: QueryLog["op"] = "select";
  private payload: Row | null = null;
  private filters: Record<string, unknown> = {};
  private orderBy: { column: string; ascending: boolean } | null = null;

  constructor(
    private readonly ctx: FakeContext,
    private readonly table: string,
  ) {}

  select(): this {
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  returns<T>(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters[column] = value;
    return this;
  }

  insert(row: Row): this {
    this.op = "insert";
    this.payload = row;
    this.ctx.insertSpy(this.table, row);
    return this;
  }

  update(patch: Row): this {
    this.op = "update";
    this.payload = patch;
    this.ctx.updateSpy(this.table, patch);
    if (this.ctx.updateError) {
      throw this.ctx.updateError;
    }
    return this;
  }

  single(): Promise<FakeResult> {
    return Promise.resolve(this.execute("single"));
  }

  maybeSingle(): Promise<FakeResult> {
    return Promise.resolve(this.execute("maybe"));
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute("many")).then(onfulfilled, onrejected);
  }

  private execute(mode: "single" | "maybe" | "many"): FakeResult {
    const rows = this.ctx.tables[this.table] ?? [];
    this.ctx.tables[this.table] = rows;

    let result: FakeResult;

    if (this.op === "insert") {
      const payload = this.payload ?? {};
      const uniqueColumn = this.ctx.uniqueColumns[this.table];
      const duplicate =
        uniqueColumn !== undefined &&
        rows.some((row) => row[uniqueColumn] === payload[uniqueColumn]);

      if (duplicate) {
        result = {
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        };
      } else {
        const row: Row = { id: randomUUID(), ...payload };
        rows.push(row);
        result = { data: row, error: null };
      }
    } else {
      const matched = rows.filter((row) =>
        Object.entries(this.filters).every(([column, value]) => row[column] === value),
      );
      if (this.op === "update") {
        matched.forEach((row) => Object.assign(row, this.payload ?? {}));
      }
      result = { data: matched, error: null };
    }

    this.ctx.queries.push({
      table: this.table,
      op: this.op,
      filters: { ...this.filters },
      payload: this.payload,
    });

    if (mode === "many") {
      if (this.orderBy && Array.isArray(result.data)) {
        const { column, ascending } = this.orderBy;
        const sorted = [...(result.data as Row[])].sort((a, b) => {
          const av = a[column];
          const bv = b[column];
          if (av === bv) return 0;
          const cmp = av! > bv! ? 1 : -1;
          return ascending ? cmp : -cmp;
        });
        return { ...result, data: sorted };
      }
      return result;
    }

    const rowsOut = Array.isArray(result.data) ? result.data : [result.data];
    const first = (rowsOut[0] ?? null) as Row | null;

    if (mode === "single" && first === null) {
      return { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
    }
    return { data: first, error: null };
  }
}

export interface FakeSupabase {
  /** Test dosyasında createClient mock'una bağlanacak istemci. */
  client: ServerClient;
  /** Doğrudan okunup/yazılabilen tablo verisi. */
  tables: Record<string, Row[]>;
  /** Çalıştırılan tüm sorguların kaydı (tablo, işlem, eq filtreleri, payload). */
  queries: QueryLog[];
  /** supabase.auth.getUser spy'ı. */
  getUser: Spy;
  /** supabase.from spy'ı. */
  from: Spy;
  /** insert(row) çağrılarının spy'ı: (table, row). */
  insert: Spy;
  /** update(patch) çağrılarının spy'ı: (table, patch). */
  update: Spy;
  setUser(user: { id: string } | null): void;
  /** Sonraki update(...) çağrıları bu hatayı fırlatır (DB hatası simülasyonu). */
  failUpdatesWith(error: Error | null): void;
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const ctx: FakeContext = {
    user: options.user === undefined ? { id: "test-user" } : options.user,
    tables: structuredClone(options.tables ?? {}),
    uniqueColumns: options.uniqueColumns ?? {},
    queries: [],
    updateError: null,
    insertSpy: vi.fn(),
    updateSpy: vi.fn(),
  };

  const getUser: Spy = vi.fn(async () => ({
    data: { user: ctx.user },
    error: ctx.user ? null : { message: "Auth session missing!", status: 401 },
  }));
  const from: Spy = vi.fn((table: unknown) => new FakeQuery(ctx, String(table)));

  const client = {
    auth: { getUser },
    from,
  } as unknown as ServerClient;

  return {
    client,
    tables: ctx.tables,
    queries: ctx.queries,
    getUser,
    from,
    insert: ctx.insertSpy,
    update: ctx.updateSpy,
    setUser(user) {
      ctx.user = user;
    },
    failUpdatesWith(error) {
      ctx.updateError = error;
    },
  };
}
