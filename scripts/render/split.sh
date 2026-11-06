# The right-hand split of the preview: a listing and the branch graph.
. "$RENDER_DIR/lib.sh"
run 'eza -l --git --icons --no-time --no-user'
run 'git status -sb'
run 'git log --graph --oneline --decorate -7'
ready
