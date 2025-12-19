# tRPC Boundary Inspector

Visualize where your tRPC calls cross the network boundary.

`tRPC Boundary Inspector` is a tool that makes tRPC network boundaries visible, especially in Next.js App Router environments. It helps you identify where communication occurs at a glance.

## Features

- **Network Boundary Mapping**: Identify whether tRPC calls are made from the Client, Server (RSC), or Edge Runtime.
- **Automatic Call-Site Tracking**: File name and line number are automatically injected at build time.
- **Zero Code Changes**: Just wrap your Next.js config - no changes to your tRPC calls needed.
- **Call Density Analysis**: See which files are communication hotspots.
- **CI Friendly**: Generate Markdown reports to track boundary crossings in your Pull Requests.

## Installation

```bash
npm install trpc-boundary-inspector
```

## Quick Start (3 Steps)

### Step 1: Wrap Next.js Config

```javascript
// next.config.js
const { withTRPCBoundaryInspector } = require("trpc-boundary-inspector/next");

module.exports = withTRPCBoundaryInspector({
  // your existing next config
});
```

### Step 2: Add the Link (Client-side)

```typescript
// trpc/client.ts
import { boundaryLink } from "trpc-boundary-inspector/runtime";

export const trpc = createTRPCReact<AppRouter>({
  links: [
    boundaryLink(),
    httpBatchLink({
      url: "/api/trpc",
      headers(opts) {
        const boundaryHeaders = (opts.opList[0]?.context as any)?.headers || {};
        return {
          "x-trpc-source": "nextjs-react",
          ...boundaryHeaders,
        };
      },
    }),
  ],
});
```

### Step 3: Add the Logger (Server-side)

```typescript
// app/api/trpc/[trpc]/route.ts
import { boundaryLogger } from "trpc-boundary-inspector/runtime";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => {
      boundaryLogger(req.headers, { url: req.url, method: req.method });
      return createTRPCContext({ headers: req.headers });
    },
  });
```

## Output Example

```
tRPC [node][server] [query] user.getAccount
  from ./app/providers/session.tsx:57
```

![output](./example/docs/output_example.png)

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Build Time (Webpack)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Custom loader detects tRPC calls by terminal method names        │
│     (.useQuery, .useMutation, .query, .mutation, etc.)               │
│                                                                      │
│  2. Babel plugin transforms AST to inject __boundary metadata        │
│                                                                      │
│     api.user.getAccount.query()                                      │
│     ↓                                                                │
│     api.user.getAccount.query(undefined, {                           │
│       trpc: { context: { __boundary: {                               │
│         file: './app/providers/session.tsx',                         │
│         line: 57,                                                    │
│         side: 'server'                                               │
│       }}}                                                            │
│     })                                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                           Runtime                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  3. boundaryLink extracts metadata and adds to URL query             │
│     → ?__b=./app/providers/session.tsx:57:server                     │
│                                                                      │
│  4. boundaryLogger parses URL and outputs formatted log              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Detected tRPC Methods

The following terminal method names are automatically detected:

- **React Query Hooks**: `useQuery`, `useMutation`, `useSuspenseQuery`, `useInfiniteQuery`, `useSuspenseInfiniteQuery`
- **Vanilla Client**: `query`, `mutation`
- **Server-side**: `prefetch`, `fetchQuery`, `fetchInfiniteQuery`, `prefetchQuery`, `prefetchInfiniteQuery`, `ensureQueryData`

## ⚠️ Turbopack Limitation

**This tool currently works with Webpack only.**

Turbopack (Next.js 15+ default) does not fully support custom Webpack loaders. 

## CLI (Static Analysis)

Scan your entire project to identify communication hotspots:

```bash
# Install globally
npm install -g trpc-boundary-inspector

# Basic scan
trpc-boundary-inspector .

# Show all hotspots with detailed call locations
trpc-boundary-inspector . --all --details

# Collapse duplicate calls in the same file
trpc-boundary-inspector . --details --collapse

# Ignore specific directories
trpc-boundary-inspector . -I node_modules .next
```

## Why?

tRPC is powerful because it makes server functions feel like local ones. However, this abstraction can lead to:

1. **Unintended Waterfalls**: Calling multiple `useQuery` hooks during render, causing sequential network requests.
2. **Boundary Confusion**: Losing track of whether code runs on the server or client, leading to unnecessary communication.
3. **Runtime Errors**: Accidental calls to Node.js-only procedures from the Edge Runtime.

This tool visualizes the "structure before the accident," supporting healthier architectural decisions.