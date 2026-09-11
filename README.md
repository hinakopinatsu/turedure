# ツレヅレ

「つながらないから、言葉と出会える。」を形にした、短歌SNSのモバイルファースト・プロトタイプです。

```bash
npm install
npm run dev
```

Node.js 18.17以上（Node.js 20推奨）が必要です。画面上で「この場所へ入る」→「詠む」と進み、五句を入力して投稿すると歌会が開きます。投稿前の歌会ロック、あはれ、有限ページ送り、垣間見、我が歌まで操作できます。

現在はUX検証用のローカル状態です。Supabase接続時のデータ設計とRLS方針は `docs/design.md` に記載しています。

## 本日の題を作るCron

Vercel Cronが毎日JST 0:05（UTC 15:05）に`GET /api/daily-theme`を呼び出します。今日の行がすでにあれば何も変更せず、存在しない場合だけ季節別リストから一件作成します。

VercelのProduction環境へ次を設定してください。

- `SUPABASE_URL`: SupabaseプロジェクトURL
- `SUPABASE_SECRET_KEY`: SupabaseのSecret Key（サーバー専用）
- `CRON_SECRET`: 十分に長いランダム値。Vercel Cronからの`Authorization: Bearer ...`検証に使用

`SUPABASE_SECRET_KEY`と`CRON_SECRET`には`NEXT_PUBLIC_`を付けないでください。ローカルでの手動確認例：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/daily-theme
```
