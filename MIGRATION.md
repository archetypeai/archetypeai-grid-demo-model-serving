# Migration: Direct Query API → Inference API

This project is the [California grid demo](https://github.com/archetypeai/archetypeai-grid-demo) with its Newton calls moved from the Direct Query API (`POST /api/lens/query`) to the Inference API: Newton C 2.6 → **Newton C 2.6** (same model, new endpoint). The UI, the CAISO feeds, the data summary sent to Newton and the quick prompts are unchanged.

All measurements below were taken on production on 2026-11-14.

## Summary

- **Endpoint:** every call is `POST /api/inference/query` on `newton-c-2.6`, text only, with the system turn in `system_prompt`.
- **Shorter answers:** the Inference API stops a query after about 58 seconds and generates more slowly than Direct Query did. With the original prompt and its 3,072-token budget, answers ran longer than on Direct Query (a median of 743 words against 481) and two of 24 timed out (`504 query_timeout`). The prompt now asks for answers under 300 words, `max_new_tokens` is 1,536, and `repetition_penalty` is 1.1, as in the [earthquake demo](https://github.com/archetypeai/archetypeai-earthquake-demo-inference-api), where the model looped while listing numbers.
- **Faster:** a median of 8 s per answer instead of 10 s on the example questions, and 12 s instead of 17 s on the quick prompts, with no timeouts. See [Results](#results).
- **Open-source fonts:** Geist and Geist Mono replace the design system's PP Neue Montreal, whose files can't be redistributed.

## Direct Query API vs Inference API

|               | Direct Query API                     | Inference API                                    |
| ------------- | ------------------------------------ | ------------------------------------------------ |
| Endpoint      | `POST /api/lens/query`               | `POST /api/inference/query`                      |
| Model         | `Newton::c2_6_8b_fp8_260424d7a55d5e` | `newton-c-2.6`                                   |
| System turn   | `instruction_prompt`                 | `system_prompt`                                  |
| Answer budget | `max_new_tokens` 3,072               | `max_new_tokens` 1,536, `repetition_penalty` 1.1 |
| Time limit    | None seen (answers took up to 36 s)  | About 58 s, then `504 query_timeout`             |
| Answer        | `response.response[0]`               | `response.response[0]`                           |

`POST /api/inference/chat/completions` runs the same model but ignores `repetition_penalty`, so this version uses `/inference/query`.

## What changed in the code

| File                       | Change                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/newton.js` | `POST /api/inference/query` on `newton-c-2.6`; the 300-word sentence added to the system prompt; 1,536 tokens and `repetition_penalty` 1.1; accepts the endpoint with or without `/api`. |
| `vite.config.js`           | The project's `.env` wins over `ATAI_*` shell variables.                                                                                                                               |
| `src/routes/layout.css`    | Geist and Geist Mono from `@fontsource-variable` instead of the design system's `fonts.css`; the font files in `static/fonts/` are gone.                                                |
| `static/demo.png`          | New screenshot.                                                                                                                                                                        |
| Removed                    | The Lens and Direct Query skills in `.claude/skills/` (listed in `CLAUDE.md`), which pointed coding agents at the old APIs.                                                            |
| `LICENSE`                  | Apache License 2.0, for the code.                                                                                                                                                      |

## Results

All three set-ups answered the same 24 questions, one at a time: the five example questions from the README and the app's three quick prompts, each on the CAISO data for 2026-11-14 cut at 12:00, 18:00 and the end of the day (the 18:00 cut catches the evening ramp).

|                                         | Direct Query, original prompt | Inference API, original prompt | Inference API, this version |
| --------------------------------------- | ----------------------------- | ------------------------------ | --------------------------- |
| Answered                                | 24/24                         | 22/24 (two timeouts at 18:00)  | 24/24                       |
| Time per answer, example questions      | 4–25 s, median 10 s           | 7–34 s, median 30 s            | 7–11 s, median 8 s          |
| Time per answer, quick prompts          | 8–36 s, median 17 s           | 15–50 s, median 38 s           | 9–13 s, median 12 s         |
| Length, median words (longest)          | 481 (1,217)                   | 743 (1,210)                    | 223 (353)                   |
| MW figures that appear in the data      | 143/211 (68%)                 | 150/210 (71%)                  | 116/156 (74%)               |

The MW figures not found in the data are mostly sums, differences and rounded values (net demand, supply gaps), at about the same rate in all three. The answers cover the same points: solar peak and sunset, battery discharge through the evening ramp, demand against forecast.

## Reproducing

The comparison scripts aren't part of the app. To check latency yourself, run `npm run dev`, open the chat and use the quick prompts; each answer's time shows in the network panel for `/api/analyze`.
