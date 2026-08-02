# Water / Colors — TikTok Idea Lab

Public board: https://bigweb-ai-agency.github.io/water-colors-ideas/

The board contains 61 normalized concepts collected from the Notion Trend Lab and the chat research.

## User rating workflow

1. Open the public board.
2. Rate ideas from 1 to 10. Ratings persist in browser `localStorage`.
3. Click **Отправить в GitHub Issue** so Codex or ChatGPT can read the selection.
4. Alternatively export `water-colors-ratings.json` and commit it under `water-colors-ideas/ratings/`.

## Codex workflow

- Read the four files under `data/ideas-*.js` for the idea catalogue.
- Read open Issues whose title starts with `Water/Colors ratings`.
- Prefer ideas rated 8–10, investigate 5–7, and de-prioritize 1–4.
- Preserve existing IDs (`idea-01` … `idea-61`) so browser ratings remain stable.
- Add future concepts as new IDs and keep source/Notion links intact.

## Notes

The current lightweight deployment embeds four representative ImageGen previews directly into the data files, so the public page has no external image-hosting dependency. The full local package with the richer visual set is available separately as a ZIP.