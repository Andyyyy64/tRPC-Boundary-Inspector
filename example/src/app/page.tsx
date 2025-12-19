import { api, HydrateClient } from '../server/trpc/server';
import { ClientTest } from './ClientTest';

export default async function Home() {
  // RSC からの Query
  const hello = await api.hello({ text: 'from RSC' });

  return (
    <HydrateClient>
      <main className="p-8 space-y-8">
        <h1 className="text-3xl font-bold">tRPC Boundary Inspector Test</h1>

        <div className="p-4 border rounded">
          <h2>Server Component (RSC)</h2>
          <p>{hello.greeting}</p>
          <p className="text-sm text-gray-500">
            ※ RSC Mutation is not supported directly in render
          </p>
        </div>

        <ClientTest />
      </main>
    </HydrateClient>
  );
}
