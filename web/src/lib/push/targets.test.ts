import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  countNewListings,
  loadTargets,
  markNotified,
  removeSubscription,
} from "./targets";

// EML-102 — AC-3 erişim filtresi + since hesabı. Gerçek PostgREST yerine, filtreleri
// uygulayan küçük bir bellek içi sahte istemci kullanılır (sorgu zinciri davranışı test edilir).

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

type FakeOptions = { failTable?: string };

function fakeAdmin(db: Db, options: FakeOptions = {}): SupabaseClient {
  const from = (table: string) => makeQuery(db, table, options);
  return { from } as unknown as SupabaseClient;
}

function makeQuery(db: Db, table: string, options: FakeOptions) {
  type Op = { kind: "select"; head: boolean } | { kind: "update"; values: Row } | { kind: "delete" };
  let op: Op = { kind: "select", head: false };
  const filters: Array<(r: Row) => boolean> = [];
  let orderKey: string | null = null;
  let range: [number, number] | null = null;

  const execute = () => {
    if (options.failTable === table) {
      return Promise.resolve({ data: null, count: null, error: { message: "boom" } });
    }
    const rows = (db[table] ??= []);
    let matched = rows.filter((r) => filters.every((f) => f(r)));

    if (op.kind === "update") {
      matched.forEach((r) => Object.assign(r, op.kind === "update" ? op.values : {}));
      return Promise.resolve({ data: null, count: null, error: null });
    }
    if (op.kind === "delete") {
      const doomed = new Set(matched);
      db[table] = rows.filter((r) => !doomed.has(r));
      return Promise.resolve({ data: null, count: null, error: null });
    }

    const count = matched.length;
    if (orderKey) {
      const key = orderKey;
      matched = [...matched].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : 1));
    }
    if (range) matched = matched.slice(range[0], range[1] + 1);
    return Promise.resolve({ data: op.head ? null : matched, count, error: null });
  };

  const q: Record<string, unknown> = {
    select: (_cols: string, o?: { count?: string; head?: boolean }) => {
      op = { kind: "select", head: o?.head === true };
      return q;
    },
    eq: (col: string, v: unknown) => {
      filters.push((r) => r[col] === v);
      return q;
    },
    in: (col: string, vs: unknown[]) => {
      filters.push((r) => vs.includes(r[col]));
      return q;
    },
    or: (expr: string) => {
      filters.push(parseOr(expr));
      return q;
    },
    gt: (col: string, v: unknown) => {
      filters.push((r) => String(r[col]) > String(v));
      return q;
    },
    order: (col: string) => {
      orderKey = col;
      return q;
    },
    range: (from: number, to: number) => {
      range = [from, to];
      return q;
    },
    update: (values: Row) => {
      op = { kind: "update", values };
      return q;
    },
    delete: () => {
      op = { kind: "delete" };
      return q;
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      execute().then(resolve, reject),
  };
  return q;
}

/** PostgREST `.or("col.is.null,col.eq.val")` ifadesinin yalnız bu testte kullanılan alt kümesi. */
function parseOr(expr: string): (r: Row) => boolean {
  const terms = expr.split(",").map((term) => {
    const [col, op, ...rest] = term.split(".");
    const val = rest.join(".");
    if (op === "is" && val === "null") return (r: Row) => r[col] == null;
    if (op === "eq") return (r: Row) => r[col] === val;
    throw new Error(`unsupported or term: ${term}`);
  });
  return (r: Row) => terms.some((f) => f(r));
}

const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";
const CREATED = "2026-10-01T00:00:00.000Z";
const NOTIFIED = "2026-10-29T10:00:00.000Z";

function sub(id: string, agentId: string, status: string, periodEnd: string): Row {
  return { id, agent_id: agentId, status, current_period_end: periodEnd };
}

function device(id: string, agentId: string, lastNotifiedAt: string | null = null): Row {
  return {
    id,
    agent_id: agentId,
    endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
    p256dh: `p256-${id}`,
    auth: `auth-${id}`,
    created_at: CREATED,
    last_notified_at: lastNotifiedAt,
  };
}

function baseDb(): Db {
  return {
    subscriptions: [
      sub("s-active", "agent-active", "active", FUTURE),
      sub("s-trialing", "agent-trialing", "trialing", FUTURE),
      sub("s-pastdue", "agent-pastdue", "past_due", FUTURE),
      sub("s-canceled", "agent-canceled", "canceled", FUTURE),
      sub("s-expired", "agent-expired", "active", PAST),
      // agent-none: hiç subscriptions satırı yok.
    ],
    push_subscriptions: [
      device("d-active", "agent-active"),
      device("d-active-2", "agent-active", NOTIFIED),
      device("d-trialing", "agent-trialing", NOTIFIED),
      device("d-pastdue", "agent-pastdue"),
      device("d-canceled", "agent-canceled"),
      device("d-expired", "agent-expired"),
      device("d-none", "agent-none"),
    ],
    listings: [],
  };
}

function ids(rows: { id: string }[] | null): string[] {
  return (rows ?? []).map((r) => r.id).sort();
}

describe("loadTargets — erişim filtresi (AC-3)", () => {
  it("active, trialing, past_due agent'ların cihazlarını döner", async () => {
    const result = await loadTargets(fakeAdmin(baseDb()));

    expect(result.error).toBeNull();
    expect(ids(result.data)).toEqual(["d-active", "d-active-2", "d-pastdue", "d-trialing"]);
  });

  it("canceled, süresi geçmiş ve aboneliksiz agent'ın satırı dönmez", async () => {
    const result = await loadTargets(fakeAdmin(baseDb()));

    const returned = ids(result.data);
    expect(returned).not.toContain("d-canceled");
    expect(returned).not.toContain("d-expired");
    expect(returned).not.toContain("d-none");
  });

  it("erişimi biten satır silinmez (yalnız atlanır)", async () => {
    const db = baseDb();
    await loadTargets(fakeAdmin(db));

    expect(db.push_subscriptions.map((r) => r.id)).toContain("d-canceled");
    expect(db.push_subscriptions.map((r) => r.id)).toContain("d-expired");
  });

  it("aynı agent'ın birden fazla abonelik satırı tek erişim sayılır, cihaz satırları tekilleşmez", async () => {
    const db = baseDb();
    db.subscriptions.push(sub("s-active-2", "agent-active", "active", FUTURE));

    const result = await loadTargets(fakeAdmin(db));

    expect(ids(result.data)).toEqual(["d-active", "d-active-2", "d-pastdue", "d-trialing"]);
  });

  it("hiç erişimli agent yoksa boş liste döner", async () => {
    const db = baseDb();
    db.subscriptions = [sub("s-canceled", "agent-canceled", "canceled", FUTURE)];

    const result = await loadTargets(fakeAdmin(db));

    expect(result).toEqual({ data: [], error: null });
  });

  it("DB hatasında error döner ve data null olur", async () => {
    const result = await loadTargets(fakeAdmin(baseDb(), { failTable: "subscriptions" }));

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("push_subscriptions okuma hatasında error döner", async () => {
    const result = await loadTargets(fakeAdmin(baseDb(), { failTable: "push_subscriptions" }));

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("1000'den fazla satır sayfalanarak eksiksiz okunur", async () => {
    const db: Db = { subscriptions: [], push_subscriptions: [], listings: [] };
    for (let i = 0; i < 1500; i++) {
      const id = `agent-${String(i).padStart(4, "0")}`;
      db.subscriptions.push(sub(`s-${id}`, id, "active", FUTURE));
      db.push_subscriptions.push(device(`d-${String(i).padStart(4, "0")}`, id));
    }

    const result = await loadTargets(fakeAdmin(db));

    expect(result.data).toHaveLength(1500);
  });
});

describe("loadTargets — since hesabı", () => {
  it("last_notified_at yoksa since = created_at", async () => {
    const result = await loadTargets(fakeAdmin(baseDb()));

    const fresh = result.data?.find((t) => t.id === "d-active");
    expect(fresh?.since).toBe(CREATED);
  });

  it("last_notified_at varsa since = last_notified_at", async () => {
    const result = await loadTargets(fakeAdmin(baseDb()));

    const notified = result.data?.find((t) => t.id === "d-trialing");
    expect(notified?.since).toBe(NOTIFIED);
  });

  it("dönen hedef alanları endpoint, p256dh, auth, agent_id içerir", async () => {
    const result = await loadTargets(fakeAdmin(baseDb()));

    const target = result.data?.find((t) => t.id === "d-pastdue");
    expect(target).toEqual({
      id: "d-pastdue",
      agent_id: "agent-pastdue",
      endpoint: "https://fcm.googleapis.com/fcm/send/d-pastdue",
      p256dh: "p256-d-pastdue",
      auth: "auth-d-pastdue",
      since: CREATED,
    });
  });
});

const AGENT_A = "11111111-1111-4111-8111-111111111111";
const AGENT_B = "22222222-2222-4222-8222-222222222222";

describe("countNewListings", () => {
  it("since'ten sonra oluşan ilanları sayar", async () => {
    const db: Db = {
      listings: [
        { id: "l1", created_at: "2026-10-29T09:00:00.000Z", owner_agent_id: null },
        { id: "l2", created_at: "2026-10-29T11:00:00.000Z", owner_agent_id: null },
        { id: "l3", created_at: "2026-10-29T12:00:00.000Z", owner_agent_id: null },
      ],
    };

    const result = await countNewListings(fakeAdmin(db), NOTIFIED, AGENT_A);

    expect(result).toEqual({ count: 2, error: null });
  });

  it("AC-S1: başka emlakçının kişisel ilanı sayılmaz; ortak havuz ve kendi ilanı sayılır", async () => {
    const after = "2026-10-29T12:00:00.000Z";
    const db: Db = {
      listings: [
        { id: "pool", created_at: after, owner_agent_id: null },
        { id: "own", created_at: after, owner_agent_id: AGENT_A },
        { id: "other", created_at: after, owner_agent_id: AGENT_B },
        { id: "old-pool", created_at: "2026-10-01T00:00:00.000Z", owner_agent_id: null },
      ],
    };

    const forA = await countNewListings(fakeAdmin(db), NOTIFIED, AGENT_A);
    const forB = await countNewListings(fakeAdmin(db), NOTIFIED, AGENT_B);

    expect(forA).toEqual({ count: 2, error: null });
    expect(forB).toEqual({ count: 2, error: null });
  });

  it("geçersiz agentId için error 'invalid agent_id' döner ve DB çağrılmaz", async () => {
    let dbCalls = 0;
    const admin = {
      from: () => {
        dbCalls += 1;
        throw new Error("DB must not be called");
      },
    } as unknown as SupabaseClient;

    const result = await countNewListings(admin, NOTIFIED, "agent-active");

    expect(result.count).toBe(0);
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toBe("invalid agent_id");
    expect(dbCalls).toBe(0);
  });

  it("DB hatasında (geçerli agentId ile) error döner", async () => {
    const result = await countNewListings(
      fakeAdmin({ listings: [] }, { failTable: "listings" }),
      NOTIFIED,
      AGENT_A,
    );

    expect(result.count).toBe(0);
    expect(result.error).toEqual({ message: "boom" });
  });
});

describe("markNotified / removeSubscription", () => {
  it("markNotified yalnız o satırın last_notified_at değerini yazar", async () => {
    const db = baseDb();
    const result = await markNotified(fakeAdmin(db), "d-active", "2026-10-30T12:00:00.000Z");

    expect(result.error).toBeNull();
    const row = db.push_subscriptions.find((r) => r.id === "d-active");
    const other = db.push_subscriptions.find((r) => r.id === "d-active-2");
    expect(row?.last_notified_at).toBe("2026-10-30T12:00:00.000Z");
    expect(other?.last_notified_at).toBe(NOTIFIED);
  });

  it("removeSubscription yalnız o satırı siler", async () => {
    const db = baseDb();
    const result = await removeSubscription(fakeAdmin(db), "d-active");

    expect(result.error).toBeNull();
    const remaining = db.push_subscriptions.map((r) => r.id);
    expect(remaining).not.toContain("d-active");
    expect(remaining).toContain("d-active-2");
  });
});
