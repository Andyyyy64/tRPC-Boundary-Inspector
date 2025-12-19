import { TRPCReactProvider } from '../server/trpc/react';
import './globals.css'; // 必要であれば（なければ削除可）

export const metadata = {
  title: 'tRPC Boundary Inspector Test',
  description: 'Testing tRPC network boundary visualization',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
