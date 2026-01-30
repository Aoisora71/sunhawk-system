# 組織状態可視化システム | サンホーク (Sunhawk System)

ソシキサーベイ（ソシキサーベイ）とグロースサーベイ（グロースサーベイ）を通じて組織の状態を可視化・分析するWebアプリケーションです。

## 📋 目次

- [概要](#概要)
- [主な機能](#主な機能)
- [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [データベース](#データベース)
- [開発](#開発)
- [デプロイメント](#デプロイメント)
- [プロジェクト構造](#プロジェクト構造)
- [主要な機能詳細](#主要な機能詳細)
- [トラブルシューティング](#トラブルシューティング)
- [ライセンス](#ライセンス)

## 🎯 概要

サンホークシステムは、組織の健康状態を測定・可視化するための包括的なプラットフォームです。従業員へのアンケート調査を通じて、組織の8つのカテゴリ（自己評価意識、変化意識、成果視点、行動優先意識、結果明確、時感覚、組織内位置認識、免責意識）を分析し、ダッシュボードやレポートで可視化します。

## ✨ 主な機能

### 📊 ソシキサーベイ（ソシキサーベイ）
- 8つのカテゴリに基づく組織状態の測定
- 単一選択問題と自由入力問題のサポート
- リアルタイムでの回答状況管理
- 部門別・職位別のスコア分析
- ソシキサーベイカテゴリ別評価レーダーチャート
- ソシキサーベイスコア推移グラフ

### 🌱 グロースサーベイ（グロースサーベイ）
- 個人の成長意識を測定
- スキップ機能付きの質問フロー
- カテゴリ別スコア分析（ルール、組織体制、評価制度、週報・会議、識学サーベイ）
- 組織のグロース状態レーダーチャート

### 👥 管理機能
- **サーベイ期間管理**: サーベイの作成、編集、削除、実行/停止、表示/非表示
- **問題管理**: 問題バンクの管理（追加、編集、削除）
- **組織管理**: 部門、職位、従業員の管理
- **回答状況管理**: 従業員の回答状況と応答率の確認
- **システム管理**: ログイン履歴、バックアップ、システム状態の確認

### 📈 ダッシュボード
- 組織平均スコアの表示
- ソシキサーベイカテゴリ別評価レーダーチャート
- ソシキサーベイ部門別スコアバーチャート
- ソシキサーベイスコア推移ラインチャート
- 詳細な個別スコア表示

### 🏢 組織図
- 部門別・職位別の組織構成図
- 従業員のスコア表示
- インタラクティブなツリービュー

### 👤 従業員ポータル
- ソシキサーベイへの参加
- グロースサーベイへの参加
- 回答状況の確認
- プロフィール管理

## 🛠 技術スタック

### フロントエンド
- **Next.js 15.5.7** - Reactフレームワーク
- **React 19.1.0** - UIライブラリ
- **TypeScript 5** - 型安全性
- **Tailwind CSS 4.1.9** - スタイリング
- **Radix UI** - アクセシブルなUIコンポーネント
- **Recharts** - データ可視化
- **React Hook Form** - フォーム管理
- **Zod** - スキーマバリデーション

### バックエンド
- **Next.js API Routes** - サーバーサイドAPI
- **PostgreSQL** - リレーショナルデータベース
- **pg (node-postgres)** - PostgreSQLクライアント
- **bcrypt** - パスワードハッシュ化
- **JOSE** - JWT認証

### その他
- **Jest** - テストフレームワーク
- **PM2** - プロセス管理
- **XLSX** - Excelファイル処理

## 🚀 セットアップ

### 前提条件

- **Node.js**: 18.0.0以上
- **PostgreSQL**: 12.0以上
- **pnpm**: パッケージマネージャー（推奨）またはnpm/yarn

### インストール手順

1. **リポジトリのクローン**
```bash
git clone <repository-url>
cd sunhawk-system
```

2. **依存関係のインストール**
```bash
pnpm install
# または
npm install
```

3. **環境変数の設定**
`.env.local`ファイルを作成し、必要な環境変数を設定します（詳細は[環境変数](#環境変数)セクションを参照）。

4. **データベースのセットアップ**
PostgreSQLデータベースを作成し、マイグレーションを実行します（詳細は[データベース](#データベース)セクションを参照）。

5. **開発サーバーの起動**
```bash
pnpm dev
# または
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションにアクセスできます。

## 🔐 環境変数

`.env.local`ファイルに以下の環境変数を設定してください：

```env
# データベース設定
DATABASE_URL=postgresql://username:password@localhost:5432/sunhawk_system
DB_SSL=false  # ローカル開発の場合はfalse、AWS本番環境の場合はtrue

# JWT認証
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# アプリケーション設定
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# メール設定（パスワードリセット機能用）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@example.com

# AWS設定（本番環境の場合）
AWS_REGION=ap-northeast-1
AWS_EXECUTION_ENV=AWS_Lambda_nodejs18.x
```

### 環境変数の説明

- **DATABASE_URL**: PostgreSQLデータベースへの接続文字列
- **DB_SSL**: SSL接続の有効/無効（ローカル開発では通常false）
- **JWT_SECRET**: JWTトークンの署名に使用する秘密鍵
- **JWT_EXPIRES_IN**: JWTトークンの有効期限
- **NEXT_PUBLIC_APP_URL**: アプリケーションの公開URL

## 🗄 データベース

### データベースの作成

```sql
CREATE DATABASE sunhawk_system;
```

### マイグレーションの実行

マイグレーションファイルは`migrations/`ディレクトリにあります。

**PowerShell (Windows):**
```powershell
$env:PGPASSWORD = "your_password"
psql $env:DATABASE_URL -f migrations\add_survey_running_display.sql
```

**Bash (Linux/Mac):**
```bash
export PGPASSWORD="your_password"
psql "$DATABASE_URL" -f migrations/add_survey_running_display.sql
```

詳細は`migrations/README.md`を参照してください。

### 主要なテーブル

- **users**: ユーザー情報（管理者、従業員）
- **departments**: 部門情報
- **jobs**: 職位情報
- **problems**: 問題バンク（ソシキサーベイの質問）
- **surveys**: サーベイ情報（期間、タイプ）
- **organizational_survey_results**: ソシキサーベイの回答結果
- **organizational_survey_summary**: ソシキサーベイのサマリー（カテゴリ別スコア）
- **growth_survey_questions**: グロースサーベイの質問
- **growth_survey_responses**: グロースサーベイの回答
- **growth_survey_summary**: グロースサーベイのサマリー

## 💻 開発

### 開発サーバーの起動

```bash
pnpm dev
```

### ビルド

```bash
pnpm build
```

### 本番環境での起動

```bash
pnpm start
```

### リント

```bash
pnpm lint
```

### テスト

```bash
# テストの実行
pnpm test

# ウォッチモード
pnpm test:watch

# カバレッジレポート
pnpm test:coverage
```

### コードスタイル

このプロジェクトは以下のコーディング規約に従います：

- **TypeScript**: 厳密な型チェックを有効化
- **ESLint**: コード品質の維持
- **Prettier**: コードフォーマット（設定ファイルがあれば）

## 🚢 デプロイメント

### AWSへのデプロイメント

このアプリケーションはAWS環境でのデプロイメントを想定しています。

1. **環境変数の設定**: AWS Systems Manager Parameter Storeまたは環境変数で設定
2. **データベース**: AWS RDS PostgreSQLを使用
3. **SSL接続**: 本番環境では`DB_SSL=true`を設定
4. **PM2**: プロセス管理にPM2を使用（`ecosystem.config.js`を参照）

### PM2での起動

```bash
pm2 start ecosystem.config.js
```

### Docker（オプション）

Dockerfileが提供されている場合は、以下のコマンドでビルド・実行できます：

```bash
docker build -t sunhawk-system .
docker run -p 3000:3000 sunhawk-system
```

## 📁 プロジェクト構造

```
sunhawk-system/
├── app/                      # Next.js App Router
│   ├── admin/               # 管理画面
│   │   ├── page.tsx         # 管理ダッシュボード
│   │   ├── survey-period-section.tsx
│   │   ├── problem-bank-section.tsx
│   │   ├── organization-section.tsx
│   │   └── survey-response-status-section.tsx
│   ├── api/                 # API Routes
│   │   ├── auth/            # 認証関連
│   │   ├── surveys/         # サーベイ関連
│   │   ├── problems/        # 問題管理
│   │   └── ...
│   ├── dashboard/           # ダッシュボード
│   ├── organization/        # 組織図
│   ├── employee-portal/     # 従業員ポータル
│   └── ...
├── components/              # Reactコンポーネント
│   ├── ui/                 # UIコンポーネント（shadcn/ui）
│   └── ...
├── lib/                     # ユーティリティ関数
│   ├── db.ts               # データベース接続
│   ├── auth-utils.ts       # 認証ユーティリティ
│   ├── validation.ts       # バリデーションスキーマ
│   └── ...
├── migrations/             # データベースマイグレーション
├── public/                 # 静的ファイル
├── styles/                 # グローバルスタイル
└── package.json           # 依存関係
```

## 📚 主要な機能詳細

### 認証システム

- JWTベースの認証
- ロールベースアクセス制御（管理者、従業員）
- パスワードリセット機能
- セッション管理

### サーベイシステム

#### ソシキサーベイ
- 8つのカテゴリによる評価
- 単一選択問題（6段階評価）
- 自由入力問題
- リアルタイム回答状況管理
- 応答率の自動計算

#### グロースサーベイ
- カテゴリ別質問（ルール、組織体制、評価制度、週報・会議、識学サーベイ）
- スキップ機能（特定の回答で次の質問をスキップ）
- 職位別フィルタリング
- 管理者は全質問にアクセス可能

### データ可視化

- **レーダーチャート**: ソシキサーベイカテゴリ別評価、組織のグロース状態
- **バーチャート**: ソシキサーベイ部門別スコア
- **ラインチャート**: ソシキサーベイスコア推移
- **テーブル**: 詳細な個別スコア、回答状況

### 組織管理

- 部門の階層構造サポート
- 部門コード・職位コードによるソート
- 組織図の可視化（部門別・職位別）
- 従業員のスコア表示

## 🔧 トラブルシューティング

### データベース接続エラー

**問題**: データベースに接続できない

**解決策**:
1. `DATABASE_URL`環境変数が正しく設定されているか確認
2. PostgreSQLが起動しているか確認
3. ファイアウォール設定を確認（AWS環境の場合）
4. SSL設定を確認（`DB_SSL`環境変数）

### 認証エラー

**問題**: ログインできない、トークンが無効

**解決策**:
1. `JWT_SECRET`環境変数が設定されているか確認
2. ブラウザのCookieをクリア
3. トークンの有効期限を確認

### ビルドエラー

**問題**: `pnpm build`が失敗する

**解決策**:
1. TypeScriptの型エラーを確認（`pnpm lint`）
2. 依存関係を再インストール（`rm -rf node_modules && pnpm install`）
3. Next.jsのキャッシュをクリア（`.next`ディレクトリを削除）

### パフォーマンス問題

**問題**: アプリケーションが遅い

**解決策**:
1. データベース接続プールの設定を確認（`lib/db.ts`）
2. クエリの最適化を確認
3. キャッシュ設定を確認
4. PM2の設定を確認（`ecosystem.config.js`）


