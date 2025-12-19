'use client';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import superjson from 'superjson';
import { boundaryLink } from 'trpc-boundary-inspector'; // 本番同様のパスに変更

import { type AppRouter } from '../api/root';
import { createQueryClient } from './query-client';

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === 'undefined') return createQueryClient();
  return (clientQueryClientSingleton ??= createQueryClient());
};

export const api = createTRPCReact<AppRouter>();

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        boundaryLink() as any, // 境界情報を付与
        httpBatchLink({
          transformer: superjson,
          url: '/api/trpc',
          headers: (opts) => {
            // ここで op.context.headers をマージすることで、リンクからの境界情報を送信可能にする
            // バッチリクエストの場合、最初のオペレーションのコンテキストを使用
            const boundaryHeaders = (opts.opList[0]?.context as any)?.headers || {};
            return {
              'x-trpc-source': 'nextjs-react',
              ...boundaryHeaders,
            };
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}
