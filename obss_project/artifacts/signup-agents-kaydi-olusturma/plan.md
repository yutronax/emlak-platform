# Plan — signup-agents-kaydi-olusturma
_Reference: atdd.md_

Frontend-pipeline: tetikleyici VAR (`signup/page.tsx`) ama Design
Direction atlandı — `login/page.tsx`'in mevcut basit form stiliyle
(Tailwind utility class, aynı layout) tutarlı bir form sayfası,
yeni bir estetik karar gerekmiyor.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/app/login/actions.ts | AC-4/5: ensureAgentRow() çağrısı eklenir | medium | backend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| web/src/lib/auth/ensureAgentRow.ts | Idempotent agent satırı oluşturma (AC-2/4/5/AC-S4) | backend |
| web/src/lib/auth/ensureAgentRow.test.ts | Idempotency, 23505 yutma, payload şekli | backend |
| web/src/app/signup/page.tsx | Kayıt formu (e-posta/şifre/company_name) | frontend |
| web/src/app/signup/actions.ts | `signUp()` + validasyon + enumeration-güvenli mesaj | backend |
| web/src/app/signup/page.test.tsx | Form validasyonu, mesaj render | frontend |
| web/src/app/signup/actions.test.ts | AC-1/2/3/6/7, AC-S1/S3 | backend |
| supabase/migrations/0006_agents_self_insert.sql | AC-S1/S2 (self-insert + is_admin kilidi) | backend |

## Dependencies
- **`login/page.tsx`** (mevcut, referans alınacak stil) — `signup/page.tsx`
  AYNI deseni kullanır (`"use client"`, `useActionState`, form).
- **Migration (`0006_agents_self_insert.sql`):**
  ```sql
  create policy agents_self_insert on agents
      for insert to authenticated
      with check (id = auth.uid() and coalesce(is_admin, false) = false);
  ```
  (AC-S1: is_admin=true denemesi RLS'te reddedilir; AC-S2: `id = auth.uid()`
  başka birinin id'siyle insert'i engeller.)
- **`ensureAgentRow(supabase, userId, companyName)`:**
  ```ts
  export async function ensureAgentRow(
    supabase: ServerClient,
    userId: string,
    companyName: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("agents")
      .insert({ id: userId, company_name: companyName });
    if (error && error.code !== "23505") {
      console.error("agents satırı oluşturulamadı", error);
      throw error;
    }
    // 23505 (zaten var) sessizce yutulur — idempotent (AC-5/AC-S4).
  }
  ```
  `is_admin` ALANI HİÇ GÖNDERİLMEZ (AC-S1) — DB default'u (`false`)
  devreye girer.
- **`signup/actions.ts`:**
  ```ts
  export async function signup(formData: FormData): Promise<{ message: string } | { error: string }> {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const companyName = String(formData.get("company_name") ?? "").trim();

    if (!email || !password) return { error: "E-posta ve şifre gerekli." };
    if (companyName.length < 2 || companyName.length > 100) {
      return { error: "Şirket adı gerekli (2-100 karakter)." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { company_name: companyName } },
    });

    const GENERIC_MESSAGE = "Kayıt alındı; hesabınız varsa e-postanızı kontrol edin veya giriş yapın.";
    if (error) {
      // AC-S3: "zaten kayıtlı" gibi varlık-sızdıran bir mesaj YAZILMAZ.
      return { message: GENERIC_MESSAGE };
    }

    if (data.session) {
      await ensureAgentRow(supabase, data.user!.id, companyName);
      redirect("/agent/dashboard");
    }

    return { message: GENERIC_MESSAGE };
  }
  ```
  (companyName signup action'ında `useActionState`'in state'ine
  TAŞINMAZ — `ensureAgentRow`'a doğrudan parametre olarak geçer, ileride
  login'den çağrılan ensureAgentRow'un company_name'i yoksa — ilk
  girişte zaten `signUp` sırasında oluşmuş olması beklenir; login'deki
  çağrı sadece AC-4'ün "session yoktu, email confirm sonrası ilk giriş"
  senaryosu için — bu durumda company_name YOK, bkz. Open Questions.)

## Migration Required?
**Yes** — `0006_agents_self_insert.sql` (yukarıda).

## Risks
(atdd.md'den taşındı, bu adımda bir açık bulundu — bkz. Open Questions)

## Open Questions
Yok — çözüldü (customer session onayıyla, seçenek a).

## Kararlar (customer session tarafından onaylandı)
`company_name`, `signUp({email, password, options: {data: {company_name}}})`
ile `auth.users.user_metadata`'ya kaydedilir. `login/actions.ts`'teki
`ensureAgentRow()` çağrısı, `company_name`'i `auth.getUser()`'ın döndürdüğü
`user.user_metadata.company_name`'den okur (signup'taki gibi formdan DEĞİL).
Gerekçe: email confirmation açık/kapalı farketmeksizin doğru çalışır,
placeholder gibi kalıcı veri kaybına yol açmaz (profil düzenleme sayfası
henüz yok). `ensureAgentRow(supabase, userId, companyName)` imzası
AYNEN kalır — çağıran taraf (signup: formdan, login: user_metadata'dan)
company_name'i nereden aldığını kendi belirler.
