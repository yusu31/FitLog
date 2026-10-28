"""FitLog の作業ルールを機械で守らせる PreToolUse hook。

止めるもの（CLAUDE.md の「厳守」を、人にもAIにも期待せず仕組みで守る）:
  1. PR のマージ操作（gh pr merge。マージは本人が GitHub 上で行う）
  2. main への push・force push（git push --force / -f / HEAD:main / origin main）
  3. 秘密情報のファイル（.env 系）の編集（.env.example は通す）

壊れても本体を止めない（fail-open）: 入力が読めない・想定外の形のときは何も出さず終了コード0。
標準出力は ASCII のみ（Windows の文字コード差で壊れないようにするため）。
"""
import json
import os
import re
import sys


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))  # ensure_ascii 既定=True なので日本語は \u 表記になる


def check_bash(command):
    # シェルの区切り（; && || |）で分け、各コマンドを個別に見る
    for part in re.split(r"&&|\|\||;|\|", command):
        words = part.split()
        if len(words) >= 3 and words[0] == "gh" and words[1] == "pr" and words[2] == "merge":
            return "PRのマージは本人がGitHub上で行う運用です（CLAUDE.md）。"
        if words and words[0] == "git":
            # git -C <dir> push や git -c k=v push のように、前置きのオプションを挟む書き方も見る
            i = 1
            while i < len(words) and words[i].startswith("-"):
                i += 2 if words[i] in ("-C", "-c") else 1
            words = ["git"] + words[i:]
        if len(words) >= 2 and words[0] == "git" and words[1] == "push":
            args = words[2:]
            if any(a in ("--force", "-f", "--force-with-lease") or a.startswith("--force-with-lease=") for a in args):
                return "force push は禁止です（CLAUDE.md）。"
            if any(a == "main" or a.endswith(":main") or a.endswith(":refs/heads/main") for a in args):
                return "main への直接 push は禁止です。ブランチを切って PR にしてください（CLAUDE.md）。"
    return None


def check_path(path):
    name = os.path.basename(path.replace("\\", "/"))
    if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
        return "秘密情報のファイル（.env 系）は編集しません。値は本人が設定します（CLAUDE.md）。"
    return None


def main():
    try:
        data = json.load(sys.stdin)
        tool = data.get("tool_name")
        tin = data.get("tool_input") or {}
        reason = None
        if tool == "Bash":
            reason = check_bash(tin.get("command") or "")
        elif tool in ("Write", "Edit", "NotebookEdit"):
            reason = check_path(tin.get("file_path") or tin.get("notebook_path") or "")
        if reason:
            deny(reason)
    except Exception:
        pass  # fail-open
    sys.exit(0)


if __name__ == "__main__":
    main()
