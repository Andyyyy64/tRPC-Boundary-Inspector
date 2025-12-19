'use client';

import { api } from '../server/trpc/react';

export function ClientTest() {
  const hello = api.hello.useQuery({ text: 'from RCC' });
  const mutation = api.testMutation.useMutation();

  return (
    <div className="p-4 border rounded">
      <h2>Client Component (RCC)</h2>
      <p>{hello.data?.greeting}</p>
      <button
        onClick={() => mutation.mutate({ name: 'RCC Mutation' })}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Run RCC Mutation
      </button>
      {mutation.data && <p>{mutation.data.message}</p>}
    </div>
  );
}
