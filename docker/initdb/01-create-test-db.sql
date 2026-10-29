-- 結合テスト専用の DB。テストは毎回 users を空にする（TRUNCATE）ので、開発の DB（fitlog）と分ける（Issue #88）。
-- この初期化は DB の保存場所（volume）を新しく作ったときだけ動く。今ある環境では一度だけ手で作る:
--   docker exec fitlog-db-1 psql -U fitlog -d fitlog -c "CREATE DATABASE fitlog_test"
CREATE DATABASE fitlog_test;
