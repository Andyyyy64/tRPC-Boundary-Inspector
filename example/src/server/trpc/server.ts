import 'server-only';

import { createHydrationHelpers } from '@trpc/react-query/rsc';
import { headers } from 'next/headers';
import { cache } from 'react';

import { createCaller, type AppRouter } from '../api/root';
import { createTRPCContext } from '../api/trpc';
import { createQueryClient } from './query-client';

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set('x-trpc-source', 'rsc');

  return createTRPCContext({
    headers: heads,
  });
});

const getQueryClient = cache(createQueryClient);
export const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient,
);
