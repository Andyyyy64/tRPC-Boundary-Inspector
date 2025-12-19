import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { boundaryLogger } from 'trpc-boundary-inspector'; // 本番同様のパスに変更

export const createTRPCContext = async (p0: {
  headers: Headers;
  url?: string;
  method?: string;
}) => {
  // ここでロガーを呼び出す。URL とメソッドを渡すことで、より正確な判定を可能に
  boundaryLogger(p0.headers, { url: p0.url, method: p0.method });
  return {
    headers: p0.headers,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
