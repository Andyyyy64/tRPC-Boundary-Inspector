# tRPC Boundary Inspector

Visualize where your tRPC calls cross the network boundary.

`tRPC Boundary Inspector` is a CLI tool that makes tRPC network boundaries visible, especially in Next.js App Router environments. It helps you identify where communication occurs at a glance.

## Features

- **Network Boundary Mapping**: Identify whether tRPC calls are made from the Client, Server (RSC), or Edge Runtime.
- **Call Density Analysis**: See which files are communication hotspots.
- **Detailed Inspection**: Pinpoint exact line numbers, procedure paths, and call types (query, mutation, etc.).
- **CI Friendly**: Generate Markdown reports to track boundary crossings in your Pull Requests.

## Installation

```bash
npm install -g trpc-boundary-inspector
```

## Usage

### 1. Runtime Logging (Recommended)

Get real-time visibility into your network crossings directly in your server logs.

#### Step 1: Add the Link (Client-side)

```typescript
// trpc/client.ts
import { boundaryLink } from "trpc-boundary-inspector";

export const trpc = createTRPCReact<AppRouter>({
  links: [
    boundaryLink(),
    httpBatchLink({ 
      url: "/api/trpc",
      // Important: merge boundary headers in batch link
      headers(opts) {
        const boundaryHeaders = (opts.opList[0]?.context as any)?.headers || {};
        return {
          "x-trpc-source": "nextjs-react",
          ...boundaryHeaders,
        };
      }
    }),
  ],
});
```

#### Step 2: Add the Logger (Server-side)

```typescript
// server/trpc/context.ts
import { boundaryLogger } from "trpc-boundary-inspector";

export const createTRPCContext = async (p0: { 
  headers: Headers; 
  url?: string; 
  method?: string 
}) => {
  // Add this line to log boundary crossings
  boundaryLogger(p0.headers, { url: p0.url, method: p0.method });
  return {};
};

// app/api/trpc/[trpc]/route.ts
const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ 
      headers: req.headers, 
      url: req.url,
      method: req.method 
    }),
  });
```

#### Step 3: Enable Automatic File/Line Tracking (Next.js)

Wrap your `next.config.js` to automatically inject call-site metadata (file name and line number) without changing your source code.

```javascript
// next.config.js
const { withTRPCBoundaryInspector } = require("trpc-boundary-inspector/next");

module.exports = withTRPCBoundaryInspector({
  // your existing next config
});
```

### 2. CLI (Static Analysis)

Scan your entire project to identify communication hotspots and aggregate boundary crossing statistics.

```bash
# Basic scan
trpc-boundary-inspector .

# Show all hotspots with detailed call locations
trpc-boundary-inspector . --all --details

# Collapse duplicate calls in the same file
trpc-boundary-inspector . --details --collapse

# Ignore specific directories
trpc-boundary-inspector . -I node_modules .next
```

## Output Example

![output](./example/docs/output_example.png)

## Why?

tRPC is powerful because it makes server functions feel like local ones. However, this abstraction can lead to:

1.  **Unintended Waterfalls**: Calling multiple `useQuery` hooks during render, causing sequential network requests.
2.  **Boundary Confusion**: Losing track of whether code runs on the server or client, leading to unnecessary communication.
3.  **Runtime Errors**: Accidental calls to Node.js-only procedures from the Edge Runtime.

This tool visualizes the "structure before the accident," supporting healthier architectural decisions.