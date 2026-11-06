# Everyday output that uses the 16 ANSI colors: git and ripgrep.
. "$RENDER_DIR/lib.sh"
run 'git log --graph --oneline --decorate -9'
run 'git diff'
run 'rg -n FOG_LIMIT'
ready
