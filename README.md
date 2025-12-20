# tRPC Boundary Inspector

Visualize where your tRPC calls cross the network boundary.

`tRPC Boundary Inspector` is a tool that makes tRPC network boundaries visible, especially in Next.js App Router environments. It helps you identify where communication occurs at a glance.

> **⚠️ Note: It is strongly recommended to use this tool ONLY in Development environments.** (See [Potential Risks](#️-important-notes--potential-risks) below for details)

## Features

- **Network Boundary Mapping**: Identify whether tRPC calls are made from the Client, Server (RSC), or Edge Runtime.
- **Automatic Call-Site Tracking**: File name and line number are automatically injected at build time.
- **Next.js 15+ & Turbopack Ready**: Powered by a high-performance SWC (Wasm) plugin.
- **Minimal Setup**: Just a one-time configuration of your tRPC link and server logger. No changes needed to individual tRPC calls.
- **CI Friendly**: Generate Markdown reports to track boundary crossings in your Pull Requests.

## Installation

```bash
npm install trpc-boundary-inspector
```

## Quick Start (Next.js 15+ / Turbopack / SWC)

The recommended setup for modern Next.js projects using SWC and Turbopack.

### Step 1: Wrap Next.js Config

Enable `useSWCPlugin` in your `next.config.js`.

```javascript
// next.config.js
import { withTRPCBoundaryInspector } from "trpc-boundary-inspector/next";

const nextConfig = {
  // your existing next config
};

export default withTRPCBoundaryInspector(nextConfig, {
  useSWCPlugin: true // Use SWC (Wasm) plugin
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
      // ...
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
    // ...
    createContext: () => {
      boundaryLogger(req.headers, { url: req.url, method: req.method });
      return createTRPCContext({ headers: req.headers });
    },
  });
```

## Legacy / Custom Babel Support (Webpack only)

If your project uses `.babelrc` or `babel.config.js` and relies on Babel instead of SWC, use the following configuration.

```javascript
// next.config.js
import { withTRPCBoundaryInspector } from "trpc-boundary-inspector/next";

export default withTRPCBoundaryInspector({
  // options default to { useSWCPlugin: false }
});
```
*Note: Turbopack is not supported in this mode.*

## Output Example

```
tRPC [node][server] [query] user.getAccount
  from ./app/providers/session.tsx:57
```

## How It Works

### 1. Build-Time: Metadata Injection (SWC / Babel)
During the compilation phase, the tool automatically transforms your tRPC calls to inject call-site metadata.

*   **SWC Plugin (Recommended)**: A high-performance Rust-based plugin that integrates directly into the SWC pipeline (the Next.js default). It analyzes the Abstract Syntax Tree (AST) to find tRPC methods like `useQuery`, `useMutation`, or `query`, and injects the file name and line number into the tRPC `context` object.
*   **Transformation**: It effectively turns `api.user.get.useQuery(input)` into `api.user.get.useQuery(input, { trpc: { context: { __boundary: { file: "...", line: ... } } } })` behind the scenes.
*   *(Legacy Note: For environments using Babel instead of SWC, a dedicated Babel plugin performs the same AST transformation, though it operates with a higher performance overhead in the Node.js runtime.)*

### 2. Runtime: Link & Logging
Once the metadata is injected into the tRPC context, it flows through the network boundary.

*   **tRPC Link (`boundaryLink`)**: This link runs on the caller's side (Client or Server). It extracts the `__boundary` metadata from the context and attaches it to the outgoing request, typically via a URL query parameter (`__b`).
*   **Server Logger (`boundaryLogger`)**: On the server-side tRPC handler, this logger parses the incoming request, identifies the caller's location and runtime environment, and prints a beautifully formatted log to the console.

## CLI (Static Analysis)

Scan your entire project to identify communication hotspots.

```bash
# Install globally
npm install -g trpc-boundary-inspector

# Basic scan
trpc-boundary-inspector .
```

![output](./example/docs/output_example.png)

## Why?

tRPC is powerful, but its abstraction can make it easy to lose track of where network communication is actually happening. This tool visualizes the "structure before the accident," supporting healthier architectural decisions.

## ⚠️ Important Notes & Potential Risks

**It is strongly recommended to use this tool ONLY in Development environments.**

1.  **Security**: Internal file paths and line numbers are exposed in URLs. **Disable in production** to avoid leaking your server's directory structure.
2.  **Caching**: Injected metadata creates unique URLs per call-site, which may bypass CDN or browser caches.
3.  **Performance**: Logging every tRPC request to the console can impact server throughput under high load.
4.  **URL Length**: Injected metadata increases URL length. Extremely long file paths might hit browser or proxy URL limits.
5.  **Stability**: SWC plugins are an experimental feature in Next.js/Turbopack. Future updates to Next.js or SWC might require plugin rebuilds.

---
