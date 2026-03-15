# Scaffold — Next.js (Append-Only Feature Architecture)

Set up a Next.js app where adding a feature = adding a directory. Core shell is frozen after scaffold.

## Arguments

$ARGUMENTS: optional project name. Default: current directory name.

## Architecture

```
app/
  layout.tsx                    ← FROZEN — root shell, auto-builds nav from features
  page.tsx                      ← FROZEN — home/dashboard
  providers.tsx                 ← FROZEN — QueryClient, auth, theme
  (features)/                   ← APPEND-ONLY — route group, each subdir is a feature
    invoice/
      page.tsx                  ← /invoice route
      [id]/page.tsx             ← /invoice/:id route
      _components/              ← feature-scoped components
      _hooks/                   ← feature-scoped hooks
      _actions/                 ← server actions for this feature
    payment/                    ← another agent adds this — zero conflict
      page.tsx
      ...
lib/
  core/                         ← FROZEN
    feature-registry.ts         ← scans (features) dirs, exports nav manifest
    api-client.ts               ← Connect-ES or fetch wrapper using gen/ts types
    auth.ts                     ← auth utilities
  components/                   ← FROZEN — shared UI primitives
    ui/                         ← button, input, card, dialog, etc.
gen/
  ts/                           ← GENERATED from proto — never hand-edit
```

## Steps

### 1. Initialize

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --no-import-alias
```

### 2. Create core structure

```bash
mkdir -p src/app/\(features\) src/lib/core src/lib/components/ui src/gen/ts
```

### 3. Feature registry — `src/lib/core/feature-registry.ts`

```typescript
import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import fs from "fs";
import path from "path";

export interface FeatureManifest {
  slug: string;        // directory name = route path
  label: string;       // display name in nav
  icon?: LucideIcon;
  order?: number;      // nav ordering (lower = higher)
}

// Auto-discover features at build time by reading the (features) directory.
// No hardcoded list. Adding a directory = adding a feature.
export function getFeatures(): FeatureManifest[] {
  const featuresDir = path.join(process.cwd(), "src/app/(features)");
  if (!fs.existsSync(featuresDir)) return [];

  return fs.readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => {
      try {
        // Each feature can optionally export a manifest from _manifest.ts
        // If not, we derive from the directory name
        const manifestPath = path.join(featuresDir, d.name, "_manifest");
        const manifest = require(manifestPath);
        return { slug: d.name, label: d.name, ...manifest.default };
      } catch {
        // No manifest — derive from directory name
        return {
          slug: d.name,
          label: d.name.charAt(0).toUpperCase() + d.name.slice(1),
        };
      }
    })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
```

### 4. Root layout — `src/app/layout.tsx` (FROZEN after scaffold)

```tsx
import { getFeatures } from "@/lib/core/feature-registry";
import { Providers } from "./providers";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const features = getFeatures();

  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex h-screen">
            {/* Sidebar — auto-built from features */}
            <nav className="w-64 border-r p-4">
              <h1 className="text-lg font-bold mb-6">App</h1>
              <ul className="space-y-2">
                <li>
                  <Link href="/" className="block p-2 rounded hover:bg-gray-100">
                    Home
                  </Link>
                </li>
                {features.map((f) => (
                  <li key={f.slug}>
                    <Link
                      href={`/${f.slug}`}
                      className="block p-2 rounded hover:bg-gray-100"
                    >
                      {f.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {/* Content */}
            <main className="flex-1 p-6 overflow-auto">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
```

### 5. Providers — `src/app/providers.tsx` (FROZEN)

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### 6. API client — `src/lib/core/api-client.ts` (FROZEN)

```typescript
// If using Connect-ES (proto-generated clients):
// import { createConnectTransport } from "@connectrpc/connect-web";
// export const transport = createConnectTransport({ baseUrl: "/api" });

// If using plain fetch:
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}
```

### 7. Example feature — `src/app/(features)/home/page.tsx`

```tsx
export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-500 mt-2">Welcome.</p>
    </div>
  );
}
```

`src/app/(features)/home/_manifest.ts`:
```typescript
export default {
  label: "Home",
  order: 0,
};
```

### 8. How agents add a feature (the template)

To add an "invoice" feature, an agent creates this directory:

```
src/app/(features)/invoice/
  _manifest.ts        ← { label: "Invoices", order: 10 }
  page.tsx             ← list page
  [id]/page.tsx        ← detail page
  _components/         ← InvoiceTable, InvoiceForm, etc.
  _hooks/              ← useInvoices, useCreateInvoice (using gen/ts types)
  _actions/            ← server actions (create, update, delete)
```

That's it. The shell picks it up automatically. No other files modified.

### 9. Install dependencies

```bash
npm install @tanstack/react-query
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

### 10. Playwright — `playwright.config.ts`

Standard config with `webServer` pointing to `npm run dev`, baseURL `http://localhost:3000`.

Create `e2e/home.spec.ts` — basic smoke test.

### 11. Dockerfile (multi-stage)

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER app
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

Add `output: "standalone"` to `next.config.ts`.

### 12. docker-compose.yml

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8080
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 10s
      timeout: 5s
      retries: 3
```

### 13. .github/workflows/ci.yml

Standard Next.js CI: install, lint, build, playwright, upload report.

### 14. Report

Explain to user:
- Core is frozen — never modify `layout.tsx`, `providers.tsx`, `lib/core/`
- Add features by creating directories under `src/app/(features)/`
- Each feature auto-appears in nav via `_manifest.ts`
- Import proto types from `gen/ts/` in feature hooks
- Agents working on different features cannot conflict
