import { TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import chalk from 'chalk';

console.log('[trpc-boundary-inspector] runtime package v0.0.9 loaded');

/**
 * tRPC Client Link: Babel プラグインが注入した境界メタデータを
 * ヘッダーと URL クエリに追加してサーバーへ送信する。
 */
export const boundaryLink = (): TRPCLink<any> => {
  return () => {
    return ({ op, next }) => {
      return observable((observer) => {
        // Babel plugin が注入した境界メタデータを取得
        const boundaryMeta = (op.context as any)?.__boundary || {};

        const headers: Record<string, string> = {
          'x-trpc-boundary-type': op.type,
          'x-trpc-boundary-path': op.path,
        };

        if (boundaryMeta.file) {
          headers['x-trpc-boundary-file'] = boundaryMeta.file;
          headers['x-trpc-boundary-line'] = String(boundaryMeta.line);
          headers['x-trpc-boundary-side'] = boundaryMeta.side;

          // バッチリクエストでも情報が失われないよう URL クエリにも付与
          const metaStr = `${boundaryMeta.file}:${boundaryMeta.line}:${boundaryMeta.side}`;
          op.path = `${op.path}?__b=${encodeURIComponent(metaStr)}`;
        }

        op.context.headers = {
          ...(op.context.headers as Record<string, string>),
          ...headers,
        };

        return next(op).subscribe(observer);
      });
    };
  };
};

/**
 * Server-side logger that outputs formatted boundary information.
 */
export const boundaryLogger = (
  headers: Headers | Record<string, string | string[] | undefined>,
  req?: { url?: string; method?: string },
) => {
  const getHeader = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) || undefined;
    const val = headers[name];
    return Array.isArray(val) ? val[0] : val;
  };

  let pathStr = getHeader('x-trpc-boundary-path');

  if ((!pathStr || pathStr === 'NONE') && req?.url) {
    const match = req.url.match(/\/api\/trpc\/([^?#]+)/);
    if (match?.[1]) {
      pathStr = match[1];
    }
  }

  if (!pathStr || pathStr === 'NONE' || pathStr === 'trpc') return;

  const decodedPath = decodeURIComponent(pathStr);
  const pathParts = decodedPath.split(',').filter(Boolean);

  const rawType = getHeader('x-trpc-boundary-type');
  const type = rawType || (req?.method?.toUpperCase() === 'POST' ? 'mutation' : 'query');
  const runtime =
    typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge' ? 'edge' : 'node';

  const typeLabel = (t: string | undefined) => {
    if (t === 'query') return chalk.blue(`[${t}]`);
    if (t === 'mutation') return chalk.yellow(`[${t}]`);
    return chalk.magenta(`[${t || 'call'}]`);
  };

  const runtimeLabel =
    runtime === 'edge' ? chalk.magenta(`[${runtime}]`) : chalk.gray(`[${runtime}]`);

  pathParts.forEach((part) => {
    let procedureName = part;
    let file = getHeader('x-trpc-boundary-file');
    let line = getHeader('x-trpc-boundary-line');
    let side =
      getHeader('x-trpc-boundary-side') ||
      (getHeader('x-trpc-source') === 'nextjs-react' ? 'client' : 'server');

    if (part.includes('?__b=')) {
      const [name, query] = part.split('?');
      procedureName = name || '';
      const params = new URLSearchParams(query);
      const meta = params.get('__b');
      if (meta) {
        const [f, l, s] = meta.split(':');
        if (f) file = f;
        if (l) line = l;
        if (s) side = s;
      }
    }

    const sideLabel = side === 'client' ? chalk.cyan(`[${side}]`) : chalk.green(`[${side}]`);
    console.log(
      `${chalk.bold('tRPC')} ${runtimeLabel}${sideLabel} ${typeLabel(type)} ${chalk.white(procedureName)}`,
    );
    if (file) {
      console.log(
        `  ${chalk.gray('from')} ${chalk.blue(file)}${line ? chalk.gray(`:${line}`) : ''}`,
      );
    }
  });
};
