# tRPC Boundary Inspector

Visualize where your tRPC calls cross the network boundary.

`tRPC Boundary Inspector` is a tool that makes tRPC network boundaries visible, especially in Next.js App Router environments. It helps you identify where communication occurs at a glance.

## Features

- **Network Boundary Mapping**: Identify whether tRPC calls are made from the Client, Server (RSC), or Edge Runtime.
- **Automatic Call-Site Tracking**: File name and line number are automatically injected at build time.
- **Next.js 15+ & Turbopack Ready**: Powered by a high-performance SWC (Wasm) plugin.
- **Zero Code Changes**: Just wrap your Next.js config - no changes to your tRPC calls needed.
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

![output](./example/docs/output_example.png)

## How It Works

1. **Build Time (SWC/Babel)**: 
   - **SWC Plugin (Wasm)**: A high-performance plugin written in Rust detects tRPC calls like `useQuery` or `useMutation` and injects metadata (file name and line number) into the `context`.
   - **Babel Plugin**: For Webpack environments, a Babel plugin performs the same transformation.
2. **Runtime**:
   - `boundaryLink` extracts the injected metadata and attaches it to HTTP headers or URL queries.
   - `boundaryLogger` receives it on the server side and outputs beautifully formatted logs.

## CLI (Static Analysis)

Scan your entire project to identify communication hotspots.

```bash
# Install globally
npm install -g trpc-boundary-inspector

# Basic scan
trpc-boundary-inspector .
```

## Why?

tRPC is powerful, but its abstraction can make it easy to lose track of where network communication is actually happening. This tool visualizes the "structure before the accident," supporting healthier architectural decisions.
