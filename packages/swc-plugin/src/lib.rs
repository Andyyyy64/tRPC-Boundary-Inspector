use std::collections::HashSet;
use std::sync::LazyLock;

use serde::Deserialize;
use swc_core::{
    common::{SourceMapper, DUMMY_SP},
    ecma::{
        ast::*,
        visit::{noop_visit_mut_type, VisitMut, VisitMutWith},
    },
    plugin::{
        metadata::TransformPluginMetadataContextKind, plugin_transform,
        proxies::{PluginSourceMapProxy, TransformPluginProgramMetadata},
    },
};

// tRPC 呼び出しの終端メソッド名（options が第2引数）
static TRPC_QUERY_METHODS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    HashSet::from([
        // クライアント呼び出し（vanilla）
        "query",
        // React Query フック（queryは input, options の形式）
        "useQuery",
        "useSuspenseQuery",
        "useSuspenseInfiniteQuery",
        "useInfiniteQuery",
        // Server-side
        "prefetch",
        "fetchQuery",
        "fetchInfiniteQuery",
        "prefetchQuery",
        "prefetchInfiniteQuery",
        "ensureQueryData",
    ])
});

// tRPC 呼び出しの終端メソッド名（options が第1引数）
static TRPC_MUTATION_METHODS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    HashSet::from([
        // クライアント呼び出し（vanilla）
        "mutation",
        // React Query フック（mutationは options のみ）
        "useMutation",
    ])
});

// プラグイン設定（将来の拡張用）
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfig {
    #[serde(default)]
    pub debug: bool,
}

// メソッドタイプ
enum MethodType {
    Query,    // options が第2引数
    Mutation, // options が第1引数
}

// ファイル情報を保持する構造体
struct TransformVisitor {
    filename: String,
    is_client: bool,
    source_map: PluginSourceMapProxy,
    #[allow(dead_code)]
    config: PluginConfig,
}

impl TransformVisitor {
    fn new(
        filename: String,
        is_client: bool,
        source_map: PluginSourceMapProxy,
        config: PluginConfig,
    ) -> Self {
        Self {
            filename,
            is_client,
            source_map,
            config,
        }
    }

    // MemberExpression から終端メソッド名とタイプを取得
    fn get_method_type(&self, expr: &MemberExpr) -> Option<MethodType> {
        match &expr.prop {
            MemberProp::Ident(ident) => {
                let name = ident.sym.as_str();
                if TRPC_QUERY_METHODS.contains(name) {
                    Some(MethodType::Query)
                } else if TRPC_MUTATION_METHODS.contains(name) {
                    Some(MethodType::Mutation)
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    // tRPC 呼び出しかどうかを判定（2階層以上のメソッドチェーン）
    fn get_trpc_method_type(&self, callee: &Callee) -> Option<MethodType> {
        let Callee::Expr(expr) = callee else {
            return None;
        };

        let Expr::Member(member) = expr.as_ref() else {
            return None;
        };

        // 終端メソッド名とタイプをチェック
        let method_type = self.get_method_type(member)?;

        // メソッドチェーンが2階層以上あることを確認
        if !matches!(member.obj.as_ref(), Expr::Member(_)) {
            return None;
        }

        Some(method_type)
    }

    // __boundary オブジェクトを生成
    fn create_boundary_object(&self, line: usize) -> Expr {
        Expr::Object(ObjectLit {
            span: DUMMY_SP,
            props: vec![
                PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: PropName::Ident(IdentName::new("file".into(), DUMMY_SP)),
                    value: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: self.filename.clone().into(),
                        raw: None,
                    }))),
                }))),
                PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: PropName::Ident(IdentName::new("line".into(), DUMMY_SP)),
                    value: Box::new(Expr::Lit(Lit::Num(Number {
                        span: DUMMY_SP,
                        value: line as f64,
                        raw: None,
                    }))),
                }))),
                PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: PropName::Ident(IdentName::new("side".into(), DUMMY_SP)),
                    value: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: if self.is_client { "client" } else { "server" }.into(),
                        raw: None,
                    }))),
                }))),
            ],
        })
    }

    // trpc.context.__boundary を注入
    fn inject_boundary(&self, call: &mut CallExpr, line: usize, method_type: MethodType) {
        let boundary_object = self.create_boundary_object(line);

        // メソッドタイプに応じて options の位置を決定
        let options_index = match method_type {
            MethodType::Query => {
                // useQuery(input, options?) - options は第2引数
                if call.args.is_empty() {
                    call.args.push(ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(
                            "undefined".into(),
                            DUMMY_SP,
                            Default::default(),
                        ))),
                    });
                }
                if call.args.len() == 1 {
                    call.args.push(ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Object(ObjectLit {
                            span: DUMMY_SP,
                            props: vec![],
                        })),
                    });
                }
                1
            }
            MethodType::Mutation => {
                // useMutation(options?) - options は第1引数
                if call.args.is_empty() {
                    call.args.push(ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Object(ObjectLit {
                            span: DUMMY_SP,
                            props: vec![],
                        })),
                    });
                }
                0
            }
        };

        let options = &mut call.args[options_index];

        // options がオブジェクトリテラルの場合のみ処理
        if let Expr::Object(obj) = options.expr.as_mut() {
            // trpc プロパティを探す or 作成
            let trpc_prop_idx = obj.props.iter().position(|p| {
                if let PropOrSpread::Prop(prop) = p {
                    if let Prop::KeyValue(kv) = prop.as_ref() {
                        if let PropName::Ident(ident) = &kv.key {
                            return ident.sym.as_str() == "trpc";
                        }
                    }
                }
                false
            });

            let trpc_obj = if let Some(idx) = trpc_prop_idx {
                // 既存の trpc プロパティを取得
                if let PropOrSpread::Prop(prop) = &mut obj.props[idx] {
                    if let Prop::KeyValue(kv) = prop.as_mut() {
                        if let Expr::Object(trpc_obj) = kv.value.as_mut() {
                            trpc_obj
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            } else {
                // trpc プロパティを新規作成
                let new_trpc_obj = ObjectLit {
                    span: DUMMY_SP,
                    props: vec![],
                };
                obj.props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(
                    KeyValueProp {
                        key: PropName::Ident(IdentName::new("trpc".into(), DUMMY_SP)),
                        value: Box::new(Expr::Object(new_trpc_obj)),
                    },
                ))));
                // 追加した要素を取得
                if let Some(PropOrSpread::Prop(prop)) = obj.props.last_mut() {
                    if let Prop::KeyValue(kv) = prop.as_mut() {
                        if let Expr::Object(trpc_obj) = kv.value.as_mut() {
                            trpc_obj
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            };

            // context プロパティを探す or 作成
            let context_prop_idx = trpc_obj.props.iter().position(|p| {
                if let PropOrSpread::Prop(prop) = p {
                    if let Prop::KeyValue(kv) = prop.as_ref() {
                        if let PropName::Ident(ident) = &kv.key {
                            return ident.sym.as_str() == "context";
                        }
                    }
                }
                false
            });

            let context_obj = if let Some(idx) = context_prop_idx {
                if let PropOrSpread::Prop(prop) = &mut trpc_obj.props[idx] {
                    if let Prop::KeyValue(kv) = prop.as_mut() {
                        if let Expr::Object(context_obj) = kv.value.as_mut() {
                            context_obj
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            } else {
                // context プロパティを新規作成
                let new_context_obj = ObjectLit {
                    span: DUMMY_SP,
                    props: vec![],
                };
                trpc_obj
                    .props
                    .push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                        key: PropName::Ident(IdentName::new("context".into(), DUMMY_SP)),
                        value: Box::new(Expr::Object(new_context_obj)),
                    }))));
                if let Some(PropOrSpread::Prop(prop)) = trpc_obj.props.last_mut() {
                    if let Prop::KeyValue(kv) = prop.as_mut() {
                        if let Expr::Object(context_obj) = kv.value.as_mut() {
                            context_obj
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            };

            // __boundary を注入
            context_obj
                .props
                .push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: PropName::Ident(IdentName::new("__boundary".into(), DUMMY_SP)),
                    value: Box::new(boundary_object),
                }))));
        }
    }
}

impl VisitMut for TransformVisitor {
    noop_visit_mut_type!();

    fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
        // 子要素を先に処理
        call.visit_mut_children_with(self);

        // tRPC 呼び出しかどうかを判定
        if let Some(method_type) = self.get_trpc_method_type(&call.callee) {
            // ソースマップから行番号を取得
            let line = self
                .source_map
                .lookup_char_pos(call.span.lo)
                .line;
            self.inject_boundary(call, line, method_type);
        }
    }
}

// "use client" ディレクティブがあるかチェック
fn has_use_client_directive(module: &Module) -> bool {
    module.body.iter().any(|item| {
        if let ModuleItem::Stmt(Stmt::Expr(expr_stmt)) = item {
            if let Expr::Lit(Lit::Str(s)) = expr_stmt.expr.as_ref() {
                return &*s.value == "use client";
            }
        }
        false
    })
}

// プラグインのエントリポイント
#[plugin_transform]
pub fn process_transform(mut program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    // ファイル名を取得
    let filename = metadata
        .get_context(&TransformPluginMetadataContextKind::Filename)
        .unwrap_or_else(|| "unknown".to_string());

    // cwd からの相対パスに変換
    let cwd = metadata
        .get_context(&TransformPluginMetadataContextKind::Cwd)
        .unwrap_or_default();
    let relative_filename = if !cwd.is_empty() && filename.starts_with(&cwd) {
        format!(".{}", &filename[cwd.len()..])
    } else {
        filename
    };

    // プラグイン設定を取得
    let config: PluginConfig = serde_json::from_str(
        &metadata
            .get_transform_plugin_config()
            .unwrap_or_else(|| "{}".to_string()),
    )
    .unwrap_or_default();

    // ソースマップを取得
    let source_map = metadata.source_map;

    // "use client" の有無をチェック
    let is_client = match &program {
        Program::Module(module) => has_use_client_directive(module),
        Program::Script(_) => false,
    };

    let mut visitor = TransformVisitor::new(relative_filename, is_client, source_map, config);

    match &mut program {
        Program::Module(module) => {
            module.visit_mut_with(&mut visitor);
        }
        Program::Script(script) => {
            script.visit_mut_with(&mut visitor);
        }
    }

    program
}
