# tRPC Boundary Inspector

> tRPC calls look like functions. This shows the network.

`tRPC Boundary Inspector` は、tRPC の呼び出しがネットワーク境界を跨いでいる箇所を可視化する CLI ツールです。
特に Next.js App Router において、どこで通信が発生しているかを一目で把握できるようにします。

## Features

- **Network Boundary Mapping**: tRPC 呼び出しが Client / Server (RSC) / Edge のどこで行われているかを特定。
- **Call Density Analysis**: どのファイルが通信の温床になっているかをヒートマップ（ランキング）形式で表示。
- **PR Friendly**: Markdown 形式でのレポート出力に対応し、CI での利用が可能。

## Installation

```bash
npm install -g trpc-boundary-inspector
```

## Usage

```bash
# プロジェクトのスキャン
trpc-boundary-inspector scan ./src

# レポートを Markdown として出力
trpc-boundary-inspector scan ./src --output trpc-report.md
```

## Why?

tRPC は非常に強力で、サーバーの関数をクライアントで直接呼んでいるかのような書き味を提供します。
しかし、その「ただの関数呼び出し」に見える性質ゆえに、以下のような問題が無意識に発生しがちです：

1. **意図しない Waterfall**: レンダー中に複数の `useQuery` を呼んでしまい、直列に通信が発生する。
2. **境界の不透明さ**: 「このコードはサーバーで動いているのか、クライアントで動いているのか」が曖昧になり、不要な通信を増やしてしまう。
3. **ランタイム事故**: Edge Runtime で Node.js 専用 API を含む Procedure を呼んでしまう。

このツールは、これらの「事故の手前の構造」を可視化し、より健全な設計をサポートします。

## License

ISC

