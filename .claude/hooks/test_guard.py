"""guard.py の合成入力テスト。使い方: python -I .claude/hooks/test_guard.py [対象スクリプトのパス]

止めるべき入力で止まり、通すべき入力で通ることを確かめる。最後に「実行件数」を表示する
（0件でも成功扱いになるのを避けるため。0件なら失敗で終わる）。
"""
import json
import os
import subprocess
import sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "guard.py")


def run(tool, tin, raw=None):
    stdin = raw if raw is not None else json.dumps({"tool_name": tool, "tool_input": tin})
    p = subprocess.run([sys.executable, "-I", TARGET], input=stdin, capture_output=True, text=True)
    denied = '"permissionDecision": "deny"' in p.stdout
    return p.returncode, denied


# (名前, ツール, 入力, 止めるべきか)
CASES = [
    ("マージ", "Bash", {"command": "gh pr merge 42 --squash"}, True),
    ("マージ(&&の後ろ)", "Bash", {"command": "git status && gh pr merge 42"}, True),
    ("force push", "Bash", {"command": "git push --force origin feat"}, True),
    ("force push -f", "Bash", {"command": "git push -f"}, True),
    ("force-with-lease", "Bash", {"command": "git push --force-with-lease origin feat"}, True),
    ("main へ push", "Bash", {"command": "git push origin main"}, True),
    ("HEAD:main", "Bash", {"command": "git push origin HEAD:main"}, True),
    ("git -C を挟んだ force push", "Bash", {"command": "git -C ../x push --force"}, True),
    ("git -c を挟んだ main への push", "Bash", {"command": "git -c core.editor=vi push origin main"}, True),
    (".env の編集", "Write", {"file_path": "c:/x/FitLog/.env"}, True),
    (".env.local の編集", "Edit", {"file_path": "c:\\x\\FitLog\\.env.local"}, True),
    ("通常の push", "Bash", {"command": "git push -u origin docs/basic-design-c-#42"}, False),
    ("ブランチ名に main を含む", "Bash", {"command": "git push origin feature/main-menu-#9"}, False),
    ("PR 作成", "Bash", {"command": "gh pr create --title t --body b"}, False),
    ("PR 表示", "Bash", {"command": "gh pr view 42 --json state"}, False),
    (".env.example の編集", "Write", {"file_path": "c:/x/FitLog/.env.example"}, False),
    ("ふつうのファイル", "Edit", {"file_path": "c:/x/FitLog/docs/design.md"}, False),
    ("別ツール", "Read", {"file_path": "c:/x/FitLog/.env"}, False),
]

failed = 0
for name, tool, tin, should_deny in CASES:
    code, denied = run(tool, tin)
    ok = code == 0 and denied == should_deny
    failed += 0 if ok else 1
    print(("OK  " if ok else "NG  ") + name)

# fail-open: 壊れた入力でも本体を止めない（終了コード0・何も出さない）
for name, raw in [("壊れたJSON", "{not json"), ("空入力", "")]:
    code, denied = run(None, None, raw=raw)
    ok = code == 0 and not denied
    failed += 0 if ok else 1
    print(("OK  " if ok else "NG  ") + "fail-open: " + name)

total = len(CASES) + 2
print(f"実行 {total} 件 / 失敗 {failed} 件")
sys.exit(1 if failed or total == 0 else 0)
