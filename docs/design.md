# ツレヅレ Phase 1 設計

## 画面

初回導入、本日の題、短歌入力、投稿後の本日の題、歌会（投稿前の閉鎖状態を含む）、垣間見、我が歌の7状態。画面遷移は下部の文字ナビゲーションに集約する。

## コンポーネント

`Header`、`Nav`、`SeasonMark`、`PoemText`を共有し、体験単位を`Welcome`、`Today`、`Composer`、`Gathering`、`Glimpse`、`Mine`に分ける。短歌データは五句の配列として一貫して扱う。

## DB（接続時）

仕様の `users / themes / poems / reactions / poem_bonds / uta_awase / uta_awase_matches / uta_awase_votes` を基本とする。Phase 1では `poems(user_id, theme_id)` と `reactions(user_id, poem_id, reaction_type)` に unique 制約を置く。通常歌は `parent_poem_id IS NULL`、返歌は親を必須とする check 制約を置く。

## Supabase RLS（接続時）

- users: 本人のみ insert、全員が user_number のみ select。
- themes: 認証済みユーザーが公開済みの題を select、運営のみ更新。
- poems: 本人は insert/select。今日の他人の歌は「同じ theme に自分の通常歌が存在する」場合だけ select。過去歌は認証済みユーザーが select。
- reactions: 自分の歌でないことを検証して本人のみ insert/delete。集計値の直接公開は避け、言葉へ変換した RPC を用意。
- 管理操作（題と撰歌）は service role を使うサーバー側処理に限定。

## 実装順序

1. UIプロトタイプで投稿前後の体験を検証
2. Supabase Auth の匿名サインインと連番発行
3. themes / poems と一日一首制約
4. 投稿済み判定を含む歌会 RLS
5. reactions、垣間見、我が歌
6. Phase 2 の返歌・結ぶ・撰歌

## 贈答歌・垣間見の追加

`202609080001_poem_exchanges.sql` で、一般番号の1〜9999無作為付与とunique制約、最大三首の`pinned_poems`、公開範囲を作成後に変更できない`poem_exchanges`、五句以外を保存できない`exchange_poems`を追加する。

追加送信はテーブルへの直接insertを許可せず、行ロックする`add_exchange_poem` RPCだけを利用する。RPCは参加者であることと、最後の送信者が自分ではないことを同一トランザクション内で検証する。私信は当事者だけ、公開返歌は認証済みユーザーが閲覧できる。垣間見は`peek_poems`経由で本人が選んだ最大三首のみを返し、他人の全歌履歴をプロフィール用途で取得しない。
