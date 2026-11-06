# The 16 ANSI colors as swatches and as text, then the text styles.
. "$RENDER_DIR/lib.sh"
names=(black red green yellow blue magenta cyan white)
swatches() {
  local base=$1 i
  for line in 1 2; do
    printf '  '
    for i in {0..7}; do printf '\e[48;5;%dm%11s\e[0m ' $((base + i)) ''; done
    printf '\n'
  done
  printf '  '
  for i in {0..7}; do printf '\e[38;5;%dm%-11s\e[0m ' $((base + i)) "$((base + i)) ${names[i]}"; done
  printf '\n\n'
}
printf '\n'
swatches 0
swatches 8
printf '  \e[1mbold\e[0m  \e[3mitalic\e[0m  \e[2mfaint\e[0m  \e[4munderline\e[0m  '
printf '\e[4:3;58;5;1mcurly\e[0m  \e[9mstrike\e[0m  \e[7minverse\e[0m  '
printf '\e[1;31mbold red\e[0m  \e[1;32mbold green\e[0m\n\n'
printf '  Selected text: fog drifts between the pines on the ridge.\n\n'
ready
