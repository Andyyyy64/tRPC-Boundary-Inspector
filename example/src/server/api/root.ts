import { createTRPCRouter, publicProcedure, createCallerFactory } from './trpc';
import { z } from 'zod';

export const appRouter = createTRPCRouter({
  hello: publicProcedure.input(z.object({ text: z.string() })).query(({ input }) => {
    return {
      greeting: `Hello ${input.text}`,
    };
  }),
  testMutation: publicProcedure.input(z.object({ name: z.string() })).mutation(({ input }) => {
    return {
      message: `Success: ${input.name}`,
    };
  }),
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
