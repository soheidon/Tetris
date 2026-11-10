# Falling Blocks v1.0

Rust + TypeScript + Tauri 2 で構築された、競技仕様準拠のシングルプレイヤー用落下ブロックデスクトップゲームです。

## 主な特徴

- **Rust による高精度ゲームエンジン**:
  - 盤面管理、テトリミノ生成、7-bag ランダマイザ、SRS Wall Kick、重力、Lock Delay、衝突判定、ライン消去、T-Spin、Combo、Back-to-Back、Perfect Clear をすべて Rust 側に完全集約。
  - 判定と描画を完全分離し、60Hz の固定タイムステップで決定論的に駆動。
- **モダンなフロントエンド**:
  - React + TypeScript + HTML Canvas 2D によるレスポンシブかつ高精度のレンダリング。
  - 高DPI（Retina / 4K）ディスプレイ対応。ダークテーマデザイン。
- **3つのゲームモード**:
  1. **Marathon**: 10ライン消去ごとに加速し、最大 20G まで到達するクラシックスコアアタック（開始レベル 1〜15 選択可能）。
  2. **Sprint (40L)**: 40ライン消去のタイムと PPS（Pieces Per Second）を競うスピードモード。
  3. **Ultra (120s)**: 2分間の制限時間内で最高スコアを目指すタイムアタックモード。
- **競技的スコアリング & 操作補助**:
  - Super Rotation System (SRS) 完全準拠（JLSTZ / I 各専用キックテーブル）。
  - T-Spin（Regular / Mini、3-Corner ルール、Test 4 kick 例外判定）。
  - Back-to-Back (1.5x)、Combo 加算ボーナス、Perfect Clear ボーナス。
  - DAS (Delayed Auto Shift) & ARR (Auto Repeat Rate) チューニング。
  - Ghost Piece（落下着地点プレビュー）、Hold 機能。
- **ローカル永続化**:
  - Tauri AppData ディレクトリへ `settings.json`（設定・キーバインド）および `records.json`（モード別上位10件ランキング）を保存。
  - 破損時自動バックアップ（`.bak`）と安全なデフォルト復旧機能。
- **音声非含有（Invariant）**:
  - BGM・効果音は一切実装せず、音声関連のライブラリや設定を含みません。

---

## 操作方法（デフォルト設定）

| 操作 | キー |
|---|---|
| 左移動 | `←` (ArrowLeft) |
| 右移動 | `→` (ArrowRight) |
| Soft Drop (高速落下) | `↓` (ArrowDown) |
| Hard Drop (即時固定) | `Space` |
| 右回転 (時計回り) | `↑` (ArrowUp) / `X` |
| 左回転 (反時計回り) | `Z` |
| Hold (ピース保留) | `C` |
| 一時停止 / 再開 | `Esc` |
| リスタート | `R` (結果画面またはポーズ時) |

※ 設定画面（Settings）よりすべてのキーバインドを変更可能です（キーの重複割り当ては自動検証により防止されます）。

---

## 開発環境とビルド手順

### 必須要件
- Node.js 18+ (推奨 20+)
- Rust 1.77+ (rustc, cargo)

### 依存関係インストール
```bash
npm install
```

### 単体テスト実行
```bash
# Rust コアエンジン 25 項目ユニットテスト
cargo test --manifest-path src-tauri/Cargo.toml

# フロントエンド型チェック & ユニットテスト
npm test
npm run build
```

### デスクトップアプリ実行
```bash
# 開発モード (ホットリロード)
npx tauri dev

# リリースビルド
npx tauri build
```

---

## ディレクトリ構成

```text
Tetris/
├── src/                          # TypeScript / React フロントエンド
│   ├── canvas/renderer.ts        # HTML Canvas 2D 描画レイヤー
│   ├── hooks/useKeyboard.ts      # 入力捕捉とキーバインド
│   ├── screens/                  # Title, Game, Pause, GameOver, Settings, Records
│   ├── services/tauriBridge.ts   # Tauri IPC クライアントラッパー
│   ├── types/                    # ゲーム状態・設定・記録 DTO 型定義
│   └── styles/main.css           # ダークテーマ UI スタイル
├── src-tauri/                    # Rust バックエンド
│   ├── src/
│   │   ├── engine/               # 純粋 Rust ゲームエンジン (Tauri非依存)
│   │   │   ├── board.rs          # 10x40 盤面・衝突・ライン消去
│   │   │   ├── piece.rs          # 7種テトリミノ・回転状態
│   │   │   ├── rotation.rs       # SRS Wall Kick テーブル
│   │   │   ├── randomizer.rs     # 7-bag ランダマイザ
│   │   │   ├── movement.rs       # DAS/ARR 物理
│   │   │   ├── scoring.rs        # T-Spin・Combo・B2B・得点
│   │   │   ├── modes.rs          # Marathon, Sprint, Ultra 進行
│   │   │   ├── state.rs          # 状態スナップショット DTO
│   │   │   └── game.rs           # 60Hz ティックステートマシン
│   │   ├── storage/              # settings.json, records.json 永続化
│   │   ├── commands/             # Tauri IPC コマンドハンドラ
│   │   ├── runtime/loop_runner.rs# Tokio 60Hz ゲームループ & 30Hz イベント通知
│   │   └── lib.rs                # Tauri アプリケーション初期化
│   └── tests/engine_tests.rs     # 必須 25 項目ユニットテスト
└── .plan/V0.1.0.md               # 正本計画書
```
