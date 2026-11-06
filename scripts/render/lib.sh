# Helpers for the scene scripts: show a command after the prompt, run it, and
# tell scripts/render.ts when the scene is ready.
cd "$RENDER_REPO" || exit 1

run() {
  printf '\e[34m~/fog\e[0m \e[35mmain\e[0m \e[32m❯\e[0m %s\n' "$1"
  eval "$1"
}

ready() {
  touch "$RENDER_MARK"
  exec bash --noprofile --rcfile "$RENDER_DIR/prompt.bashrc" -i
}
