import { types as t, NodePath } from '@babel/core';

// tRPC 呼び出しの終端メソッド名（変数名に依存しない検出）
const TRPC_TERMINAL_METHODS = new Set([
  // クライアント呼び出し（vanilla）
  'query',
  'mutation',
  // React Query フック
  'useQuery',
  'useMutation',
  'useSuspenseQuery',
  'useSuspenseInfiniteQuery',
  'useInfiniteQuery',
  // Server-side
  'prefetch',
  'fetchQuery',
  'fetchInfiniteQuery',
  'prefetchQuery',
  'prefetchInfiniteQuery',
  'ensureQueryData',
]);

/**
 * tRPC 呼び出しかどうかを AST で判定する。
 * 変数名に依存せず、メソッドチェーンの終端メソッド名で検出する。
 * 例: api.user.getAccount.useQuery() → 終端が useQuery なので tRPC
 */
function isTrpcCall(callee: t.Expression): boolean {
  if (!t.isMemberExpression(callee)) return false;

  // callee.property が終端メソッド名
  const methodName = t.isIdentifier(callee.property) ? callee.property.name : null;
  if (!methodName || !TRPC_TERMINAL_METHODS.has(methodName)) return false;

  // メソッドチェーンが2階層以上あることを確認（api.user.xxx.query の形）
  // callee.object も MemberExpression である必要がある
  const parent = callee.object;
  if (!t.isMemberExpression(parent)) return false;

  return true;
}

/**
 * Babel plugin to inject boundary metadata into tRPC calls via context.
 */
export default function trpcBoundaryInspectorBabelPlugin() {
  return {
    name: 'trpc-boundary-inspector-babel-plugin',
    visitor: {
      CallExpression(pathNode: NodePath<t.CallExpression>, state: any) {
        const callee = pathNode.node.callee;

        if (isTrpcCall(callee as t.Expression)) {
          const fullPath = state.filename || 'unknown';
          const fileName = fullPath.replace(process.cwd(), '.');
          const line = pathNode.node.loc?.start.line || 0;

          const isClient = state.file.ast.program.directives.some(
            (d: any) => d.value.value === 'use client',
          );

          const boundaryData = t.objectExpression([
            t.objectProperty(t.identifier('file'), t.stringLiteral(fileName)),
            t.objectProperty(t.identifier('line'), t.numericLiteral(line)),
            t.objectProperty(t.identifier('side'), t.stringLiteral(isClient ? 'client' : 'server')),
          ]);

          const args = pathNode.node.arguments;
          if (args.length === 0) {
            args.push(t.identifier('undefined'));
          }

          let options = args[1];
          if (!options || t.isIdentifier(options, { name: 'undefined' })) {
            options = t.objectExpression([]);
            args[1] = options;
          }

          if (t.isObjectExpression(options)) {
            // tRPC context に __boundary を注入
            let trpcProp = options.properties.find(
              (p: any) => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'trpc',
            ) as t.ObjectProperty;

            if (!trpcProp) {
              trpcProp = t.objectProperty(t.identifier('trpc'), t.objectExpression([]));
              options.properties.push(trpcProp);
            }

            const trpcObj = trpcProp.value as t.ObjectExpression;
            let contextProp = trpcObj.properties.find(
              (p: any) =>
                t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'context',
            ) as t.ObjectProperty;

            if (!contextProp) {
              contextProp = t.objectProperty(t.identifier('context'), t.objectExpression([]));
              trpcObj.properties.push(contextProp);
            }

            const contextObj = contextProp.value as t.ObjectExpression;
            contextObj.properties.push(t.objectProperty(t.identifier('__boundary'), boundaryData));
          }
        }
      },
    },
  };
}
