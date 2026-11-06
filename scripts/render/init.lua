-- Neovim for the preview scene: mistpine.nvim and Tree-sitter, nothing else.
-- scripts/render.ts sets MISTPINE_NVIM, NVIM_TS_QUERIES and NVIM_TS_PARSERS.
for _, dir in ipairs({ vim.env.NVIM_TS_QUERIES, vim.env.NVIM_TS_PARSERS, vim.env.MISTPINE_NVIM }) do
  vim.opt.runtimepath:prepend(dir)
end
vim.o.termguicolors = true
vim.o.number = true
vim.o.wrap = false
-- The render clicks this pane to focus it; keep the cursor where it is.
vim.o.mouse = ""
vim.o.cursorline = true
vim.o.signcolumn = "yes"
vim.o.laststatus = 3
vim.o.showmode = false
vim.o.swapfile = false
vim.cmd.colorscheme("mistpine")

vim.api.nvim_create_autocmd("FileType", {
  callback = function(ev)
    pcall(vim.treesitter.start, ev.buf)
  end,
})

vim.api.nvim_create_autocmd("VimEnter", {
  callback = function()
    vim.fn.search("reading.humidity")
    vim.fn.setreg("/", "station")
    vim.o.hlsearch = true
    vim.defer_fn(function()
      vim.fn.writefile({}, vim.env.RENDER_MARK)
    end, 300)
  end,
})
