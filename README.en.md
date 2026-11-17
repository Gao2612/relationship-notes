# Relationship Notes for DSH · 关系手记

[中文](README.md) | **English** | [日本語](README.ja.md)

Relationship Notes 3.3.0 (including the unreleased 2026-11-16 updates). A local-first plugin for contact profiles, interaction evidence and reply drafts. It runs in the "Custom Modules" (定制模块) area of DSH (DeepSeek Harness).

> The Chinese README is the primary version. This translation follows it section by section. The plugin UI itself is mainly in Chinese, so UI labels are given in Chinese with an English gloss.

## Contents

- [Overview](#overview)
- [Main features](#main-features)
- [Interface and interaction](#interface-and-interaction)
- [Installation](#installation)
- [Usage](#usage)
- [DSH compatibility](#dsh-compatibility)
- [Scoring and analysis rules (relationship analysis v3)](#scoring-and-analysis-rules-relationship-analysis-v3)
- [Data and models](#data-and-models)
- [Internationalization (experimental, navigation text only)](#internationalization-experimental-navigation-text-only)
- [Development and release history](#development-and-release-history)
- [Appendix: affinity-cue score v2.3](#appendix-affinity-cue-score-v23-still-used-by-the-daily-timeline-and-interaction-scores)
- [Maintenance and license](#maintenance-and-license)

## Overview

Relationship Notes turns imported WeChat/QQ chat histories into contact profiles, day-by-day interaction evidence and relationship analysis, and helps you draft replies.

- **Local first**: chats, profiles, drafts and your own self-profile are stored in the browser's local IndexedDB. The relevant context is sent to the model service configured in DSH only when you start an AI feature.
- **Checkable evidence**: every score, profile entry, topic and review item can open the original message with its surrounding context. Misdetections can be excluded and restored.
- **No "affection probability"**: every index summarizes observable interaction processes. None of them is "the probability that the other person likes you".

## Main features

### Current features

**Relationship analysis v3 (main analysis)**

- Weekly assessment of six research-based interaction dimensions — responsiveness, self-disclosure, reciprocity, positivity, engagement and linguistic coordination — with friction and repair discounting the composite index.
- The rule layer is checkable and repeatable; each dimension is shrunk toward neutral according to its evidence, with an 80% interval, and weeks without chats are shown as gaps.
- Optional AI context ratings: every rating must quote the source text verbatim (validated by the host), is fused with limited weight, is flagged for checking when it disagrees with the rules, and cannot trigger the boundary cap on its own.
- Long-term change: EWMA, weighted trend with interval, change points and phases, showing which dimensions drove each change.
- Evidence is split into source facts / AI quotes / AI inferences, all of which can open the original context. Rules and formulas: see [Scoring and analysis rules](#scoring-and-analysis-rules-relationship-analysis-v3).

**Rule detection and daily scores (affinity-cue score v2.3)**

- Context-aware scoring uses the previous turn's question, suggestion and topic to detect answers, accepted suggestions and follow-ups, and counts effective-response turns.
- A single acknowledgement or laugh is neutral. The short-reply penalty applies only after three consecutive turns without an effective response.
- Colloquial sharing handles subject changes and natural phrasing, and excludes system messages, media and placeholder-only text.
- The interaction-metrics page shows the engagement score, positive-expression evidence, and work / daily / mixed scene statistics separately. Positive expressions are labeled as politeness, support or closeness.
- Supportive responses are detected against the previous turn's feelings or good news. Emotional sharing and plain factual sharing are weighted separately.
- Ten detection types can be checked against the original text, excluded and restored. Corrections update the related counts and scores (both v2.3 and the v3 rule layer).
- Positive signals are de-duplicated per turn and capped. Small-sample scores are shrunk toward 32. Reply latency is descriptive only, and explanations do not increase the friction penalty.
- The additions and deductions in the score breakdown sum to the final score. Turn counts and monthly/yearly aggregation use the same definitions. Formulas: see the [appendix](#appendix-affinity-cue-score-v23-still-used-by-the-daily-timeline-and-interaction-scores).

### Profile and communication features

- Profile entries, scores, topics and review items can open the original message and its surrounding context.
- Contact facts and your own plans support validity periods, done, cancelled, expired and reopen. Finished plans drop out of current suggestions and model context.
- An edited draft can be explicitly saved as an example of your own writing, and that save can be undone.
- Topics can be marked "already discussed / not suitable", hidden and restored.
- Behavior records include weekly/monthly reviews that summarize real topics, questions with no follow-up response, and current follow-up items.
- Settings let you preview and limit the date range and message count shared with DSH. Re-authorization is required after applying.
- New messages use persistent IDs, and old references remain compatible. A standalone view and an automatic delivery checklist were added.

See [Features and entry points](docs/FEATURES-3.2.md) (Chinese). Screenshots contain real contacts and chat content, so they are not published in this repository.

### Feature list

Main features and where to find them:

1. **Contact profile** (联系人档案): review and confirm profile facts proposed by the model; communication style, boundaries, follow-ups and inferred cues are shown separately; supports validity periods, archiving and deletion.
2. **Relationship analysis** (关系分析; new, default page of "Records & Scores"): six-dimension weekly assessment, composite index with 80% interval, AI ratings, long-term trend and change points, three-column evidence.
3. **Daily timeline** (每日历程): per-day interaction score, real topics and "no follow-up response" questions, with the original messages and context.
4. **Interaction scores** (互动评分): engagement score, positive-expression count, answer and follow-up turns, and per-scene results; expand the basis to see expression levels, and exclude or restore misdetections.
5. **Scoring rules** (评分规则): formulas, weights and clauses, with sentence-level explanations.
6. **Record list** (记录列表): paginated, searchable, newest-first view of all chat records, linking back to the original position.
7. **Conversation** (会话): the full conversation per contact, including images and voice; drafts, related pages and the editor sit in a fixed right-hand pane.
8. **Communication assistant** (沟通辅助): candidate drafts in sincere / relaxed / short styles, with citations and uncertainty notes; drafts can be saved as your own examples.
9. **Topic suggestions** (话题建议): generate topics, mark them "already discussed / not suitable" to hide them, and restore them at any time.
10. **Action plans** (行动计划): add goals manually, set validity periods, mark done, cancelled, expired or reopened.
11. **Weekly/monthly reviews and settings** (周月复盘与设置): summary of real topics, unanswered questions and follow-ups. Settings include model selection, font size and density, backup export/restore, and a preview of the DSH sharing scope.

## Interface and interaction

The 2026-11 UI update keeps every existing feature and the data structures unchanged.

- **Visual system**: celadon (actions and selection), lotus (only for the relationship pulse), indigo (AI), amber (inferences / needs checking), vermilion (refusals and friction). All colors are derived from the host background/foreground, so light and dark themes stay consistent. Numbers use old-style serif figures (Palatino / Georgia).
- **Relationship identity strip**: the header shows the other person's avatar and name, message count, last chat date, and a 20-week interaction-index sparkline with the latest value. Click it to open relationship analysis.
- **Navigation**: top-level navigation has line icons. On phone widths it moves to a fixed tab bar at the bottom of the screen (safe-area aware).
- **Hierarchy**: feature cards (first-run guide, relationship-analysis overview) > flat sections > lightly tinted items. Shadows are reserved for floating layers such as menus, toasts and drawers.
- **Import**: drag and drop files. When there are exactly two speakers and "me" can be identified, identities are preselected; use "⇄ 交换" (swap) to flip them. The source filter (All / WeChat / QQ) is a segmented control, and sources with no records are disabled.
- **Conversation**: on narrow screens (≤900px) the conversation list opens as a drawer, closed by tapping the backdrop or pressing Esc, and the "☰ 列表" (list) button state matches actual visibility. On wide screens "工具" (tools) collapses the right pane. Ctrl/⌘ + Enter in the reply-intent box generates a reply.
- **Toasts and motion**: status messages appear as a floating toast at the bottom (normal messages close after 6 seconds; errors stay). Page changes use one short fade. `prefers-reduced-motion` is respected, 44px hit targets are kept, and contrast is ≥4.5:1.

## Installation

### Installing a built ZIP

Take an installation ZIP from a release or a local build and extract it into its own directory. Check that the directory contains `package.json`, `index.js`, `client.js` and `cordis.patch.yml`. In DSH's local plugin install/load entry, select that directory, enable Relationship Notes and its "Custom Modules" container dependency, and then reload the host plugin service. If your DSH has no reload entry, restart DSH. The package already includes `client.js`, so you don't need to run pnpm install, build or test.

Export a Relationship Notes backup before upgrading. Point the local plugin load location at the newly extracted directory and reload the host service. Refreshing the page alone may keep using the old host routes (for example, the `/affinity-analysis` route needed by relationship analysis). Then open Relationship Notes in "Custom Modules". The installation ZIP is a runtime package without the full build/test tooling; use the source repository for development.

### Building and verifying from source

Get the full source (including `build.mjs`, `verify-v3.mjs`, `pnpm-lock.yaml` and the test files) and use Node.js and pnpm. Verification used Node.js 22.

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm test
```

The build uses explicit ESM modules and esbuild, and does not depend on prototype files outside the repository. `client.js` is a generated artifact tracked in the repository: after changing client sources, rebuild and commit it together with the change. The installation package ships this artifact. For source layering and dependency direction, see [Architecture and maintenance boundaries](docs/ARCHITECTURE.md) (Chinese).

### Release packaging

After building, you can preview the delivered files and then generate the installation package.

```sh
node tools/package-release.mjs --out <new output directory> --dry-run
node tools/package-release.mjs --out <new output directory>
```

The packaging tool uses Windows PowerShell and the .NET compression library. It selects content by the release file list, excludes dependencies, tests and historical archives, and produces a ZIP, a SHA256 file and a per-file manifest. It refuses to overwrite existing output with the same name, and requires a rebuild first if sources are newer than the client artifact.

## Usage

- Open Relationship Notes in DSH "Custom Modules", import a chat file (drag and drop works) and confirm both identities.
- In the contact profile, review entries the model marked as pending, then accept, edit, archive or delete them. Communication style, boundaries, follow-ups and inferred cues are shown separately.
- In "Records & Scores → Relationship analysis" (记录与评分 → 关系分析), see the rule-layer results. Click "AI 分析" (AI analysis) to have the DSH model rate each week (cancel at any time). Results are cached per week.
- In settings, maintain your own tone, verbal habits, interests, plans, boundaries and approved examples. Reply generation uses these together with principles such as sincere expression, respecting boundaries and not testing the relationship with probes.
- Interaction scores can be expanded to the original text; mark misdetections and restore them. The index summarizes expression cues; it is not an affection probability.
- The reply pane offers sincere / relaxed / short styles and proactively generates several possible interpretations and reply ideas, with citations and uncertainty.
- If the main DSH chat needs to read profile data, explicitly turn on "允许 DSH 读取当前联系人" (allow DSH to read the current contact). It can read confirmed profile entries, search up to the latest 500 shared messages and propose pending candidates. The sharing scope is tool conversations in the current local DSH host; see [Profile tools](docs/PROFILE-TOOLS.md) (Chinese).
- Project backups can include or exclude media. Older backups can still be restored.

WeChat/QQ monitoring, an independent replacement for ExportWeChat reading, automatic sending and proactive messaging are on hold; only a [research plan](docs/CAPTURE-RESEARCH.md) (Chinese) exists. Importing existing ExportWeChat JSON/HTML files remains available.

## DSH compatibility

| Host | Status | Notes |
| --- | --- | --- |
| DSH desktop (provides the `subdsh` container) | Supported | Registered as a sub-page with ID `relationship-notes`; the registration id, label and order are unchanged. |
| npm public DSH Web (tested with `@deepseek-ai/dsh` 0.2.2-rc.1) | Supported | When the host has no `subdsh`, a panel with the same name is registered in the native sidebar instead, so host startup is no longer blocked. The dark theme is adapted through `--dsw-alias-*` tokens. |

- **Container contract**: the top level declares only `inject: ['locale']`. `subdsh` is awaited through a nested inject inside the plugin and is not a required dependency.
- **Host routes**: the reply, import, profile, interpretation and `affinity-analysis` routes under `/api/relationship-notes/`; see [Host API](docs/HOST-API.md) (Chinese).
- **Theme**: colors are derived from host theme variables (with a `--dsw-alias-*` fallback chain, `src/host-tokens.js`). All four combinations of light/dark × PC/phone were verified in a real DSH Web instance.
- **Model**: AI features use the model service configured in DSH (`llm.prepareCall`). Without an API key, AI requests fail (observed as 502); rule-layer features are unaffected.
- Known limitations: see [Known issues](docs/KNOWN-ISSUES.md) (Chinese).

## Scoring and analysis rules (relationship analysis v3)

"Records & Scores → Relationship analysis" (记录与评分 → 关系分析) is the plugin's main analysis page, and the relationship pulse sparkline in the header uses the same result. This section matches the code item by item: `src/affinity/` (rule layer, model, long-term change) and `affinity-service.js` (AI route and validation), model version `3.0`.

v3 does not output a single "affection score". It assesses six research-based interaction processes per week, plus friction and repair, and puts rule statistics, AI context ratings, long-term change and per-item source evidence on one page. Every index summarizes **observable interaction processes**. It is not "the probability that the other person likes you", and it does not diagnose attachment style or personality.

### Pipeline

1. **Turns and weeks**: messages are merged into turns, and the observable interaction facts of both sides are aggregated per week (weeks start on Monday, Shanghai time).
2. **Rule layer**: computes each of the six dimensions' raw value $x$ (0–1) and amount of evidence $n$, plus friction strength and boundaries.
3. **Shrinkage**: each dimension is shrunk toward the neutral value 0.5 according to its amount of evidence, with a standard error.
4. **AI layer (optional)**: after you click "AI 分析" (AI analysis), the model rates each week on anchored scales. Only ratings with verbatim quotes are fused, with limited weight.
5. **Composite index**: weighted average × friction discount, capped at 30 in weeks with an explicit boundary, with an 80% interval.
6. **Long-term change**: gaps, EWMA, trend, change points and phases.
7. **Explanation**: each dimension has three columns — source facts / AI quotes / AI inferences — all of which can open the original context.

### Turns, conversation segments and weeks

- Scoring uses only text messages from the two people, and excludes system messages, non-text media records and placeholder-only text (same as the daily score).
- Consecutive messages from the same person no more than 3 minutes apart are merged into one turn. A first message, or a gap of 120 minutes or more since the end of the previous turn, starts a new conversation segment, and that turn counts as one "initiation".
- Times are assigned to dates in Shanghai time, then to weeks starting on Monday. Weeks without any messages get no score and appear in the series as gaps (not 0).
- For the other person's turns, the detection of answers, follow-ups, friction, explanations, perfunctory and low-information replies, together with manual corrections, reuses the same detection as the daily score (see the [appendix](#appendix-affinity-cue-score-v23-still-used-by-the-daily-timeline-and-interaction-scores)), so the source evidence of both is consistent.
- On top of that, v3 adds three things: turning toward after my "bids" (including support and follow-up questions), my good-news situations, and common apologies/clarifications as repair (these can only reduce friction).

**Bid**: a turn of mine that contains a question or a disclosure. The other person's next turn is classified into four types:

| Type | Condition |
| --- | --- |
| Unanswered | The next turn is not the other person's, or comes 24 hours or more later; not counted in the responsiveness denominator (text chat can be asynchronous) |
| Against | The other person's turn contains an explicit refusal/boundary or friction |
| Toward | The other person answers or follows up; or expresses support/specific thanks (positive weight ≥ 4); or asks a follow-up question on that topic within the same segment |
| Away | Anything else (possibly a natural topic change, possibly a missed detection) |

**Good-news situation**: when my turn contains the first person "我" (I) and a good-news word (such as "通过了" passed, "拿到" got, "升职" promoted, "终于" finally), and the other person responds within 24 hours, it counts as one opportunity. If the response has no friction and is support/specific thanks (positive ≥ 4), or asks a question or answers/follows up while also expressing something positive (positive ≥ 1), it counts as an active-constructive response.

### Six dimensions and rule-layer formulas

Let $t$ be the other person's turn count. All counts are turn counts (the same signal type counts once per turn).

| Dimension | Weight | Rule-layer raw value $x$ | Evidence $n$ | Main sources |
| --- | --- | --- | --- | --- |
| Responsiveness | 0.28 | toward ÷ (toward + away + against) | Number of my bids that were answered | Reis et al. 2004; Laurenceau et al. 1998; Gottman & Driver 2005 |
| Self-disclosure | 0.18 | min(1, (other's disclosures + 0.5 × other's feeling disclosures) ÷ (0.6 × $t$)) | $t$ | Collins & Miller 1994; Laurenceau et al. 1998 |
| Reciprocity | 0.16 | Average of $1-\lvert a-b\rvert/(a+b)$ over disclosure rate, question rate and initiation count | Sum of both sides' disclosures, questions and initiations | Sprecher et al. 2013 |
| Positivity | 0.14 | 0.5 × min(1, other's positive points ÷ 2$t$) + 0.5 × share of good news that got an active-constructive response; only the first term when there is no good-news situation | $t$ + good-news opportunities | Gable et al. 2004 |
| Engagement | 0.14 | Average of the other's share of initiations and min(1, other's bid turns ÷ 0.5$t$) | Both sides' initiations + $t$ | Gottman & Driver 2005; Stafford & Canary 1991 |
| Linguistic coordination | 0.10 | Average of $1-\lvert p_1-p_2\rvert/(p_1+p_2)$ over nine function-word categories per 100 characters (LSM, approximate Chinese word list, longest match); not computed if either side has fewer than 40 characters | min(12, ⌊characters of the shorter side ÷ 20⌋) | Ireland et al. 2011 |

- In reciprocity, the disclosure and question rates are "turns of that type ÷ that side's turns", and initiations are compared as counts. Only balance matters, not who does more.
- The other person's positive points: the strongest positive expression in each turn — politeness/emoji 1, support or specific thanks 4, direct closeness 6.
- The other person's bid turns: turns where the other person asks a question or discloses.
- When a dimension has no computable data, $x$ is missing and becomes 0.5 after shrinkage.
- Reply latency and message length enter no dimension (slow replies and short messages relate to communication habits and attachment differences; Morey et al. 2013).

**Friction and repair** (not a weighted dimension but a discount on the composite index):

$$
F_{\text{raw}}=\min\!\left(1,\ \frac{2\,(c+0.5\,e)}{\max(4,t)}\right),\qquad
F_{\text{rule}}=F_{\text{raw}}\times(1-0.5\,\rho),\qquad \rho=\min\!\left(1,\frac{r}{c}\right)
$$

Here $c$ is the other person's friction turns, $e$ their perfunctory or low-information turns, and $r$ their explanation, reconciliation or common-apology turns ($\rho=0$ when $c=0$). Sources: Gottman & Levenson 1992; Salvatore et al. 2011.

**Boundary**: if the other person's turns contain a non-excluded explicit refusal or request to stop contact, the boundary cap applies to that week.

### Shrinkage and intervals

Each dimension is shrunk toward the neutral prior 0.5 in the empirical-Bayes form of a beta-binomial model ($k=4$):

$$
\hat d=\frac{n\,x+k\cdot0.5}{n+k},\qquad \mathrm{SE}=\sqrt{\frac{\hat d\,(1-\hat d)}{n+k}}
$$

With little evidence the estimate stays close to 0.5, so one or two sentences cannot produce an extreme value. The friction prior is 0 (no evidence means no friction): $\hat F=\dfrac{t\,F_{\text{rule}}}{t+4}$.

### AI context ratings and fusion

After you click "AI 分析", the plugin sends each week's chat to the model configured in DSH (route `POST /api/relationship-notes/affinity-analysis`, temperature 0.1, at most 3500 tokens, 90-second timeout). You can cancel at any time.

- **What is sent**: at most 80 messages per week, at most 300 characters each. If there are more, turns of the other person containing disclosure, friction, repair, a boundary, strong positivity (≥ 4) or a question are kept first, together with my preceding turn; the rest are sampled evenly over time, and the model is told the sampling ratio. The previous week's AI summary is passed as background (not usable as evidence). Weeks without messages from the other person are not sent.
- **Scales**: responsiveness, self-disclosure, reciprocity, positivity, engagement and friction each get an integer from 1 to 5, or null if evidence is insufficient; confidence is low/medium/high. Friction runs the other way (1 = no friction) and also reports whether friction this week was repaired (`repaired`). The prompt gives 1 / 3 / 5 anchors for each dimension.
- **Output requirements**: every non-null rating carries 1–3 quotes, each a verbatim contiguous excerpt of the corresponding message. `note` only describes what the sentence does; `inference` gives a possible interpretation and must use uncertain wording; `alternatives` gives at least one other explanation.
- **Host validation** (any violation rejects the whole week with 502): allowed dimensions only; ratings are integers 1–5 or null; confidence is one of the allowed values; each non-null rating has at least one quote; quotes match verbatim; boundary quotes come only from the other person; affection probabilities or percentages, definitive wording such as "肯定/一定/证明……喜欢你" (definitely/proves … likes you), and attachment-style or personality diagnoses are rejected.

An AI rating $r$ maps to $a=(r-1)/4$. With confidence weight $c_{\text{AI}}\in\{0.5,\,1,\,1.5\}$ (low/medium/high), the pseudo-count is $m=4\,c_{\text{AI}}$:

$$
\tilde d=\frac{n\,x+k\cdot0.5+m\,a}{n+k+m},\qquad
d=\hat d+\mathrm{clip}\big(\tilde d-\hat d,\ -0.25,\ 0.25\big),\qquad
\mathrm{SE}=\sqrt{\frac{d\,(1-d)}{n+k+m}}
$$

- AI ratings without quotes or with `rating` null are ignored, and that dimension uses the rule layer only. Linguistic coordination does not accept AI ratings.
- When the rule layer has a value, $n\ge3$ and $\lvert a-x\rvert>0.35$, the dimension is flagged "rule and AI disagree, please check".
- Friction is fused the same way (prior 0) with the same ±0.25 shift limit; if the AI says friction was repaired, friction is further × 0.75.
- **Only the rule layer triggers the boundary cap.** If only the AI detects a boundary, the week is flagged for manual review and the index is unchanged.
- Results are cached per week in the contact data and bound to a fingerprint of that week's messages. When the week's chat is added to or edited, it automatically becomes pending again (manual corrections only affect the rule layer, which is recomputed immediately). Requests stop after two consecutive weekly failures, to avoid repeated requests while the model is unavailable.

### Composite index, interval and reliability

$$
P=\frac{\sum_k w_k d_k}{\sum_k w_k},\qquad
\mathrm{SE}_P=\frac{\sqrt{\sum_k (w_k\,\mathrm{SE}_k)^2}}{\sum_k w_k},\qquad
I=100\times P\times(1-0.6\,F)
$$

- 80% interval: $100\times\mathrm{clip}(P\mp1.2816\,\mathrm{SE}_P,\,0,\,1)\times(1-0.6F)$.
- In weeks with a rule-layer boundary, the index and both interval bounds are at most 30. The index is rounded to an integer (0–100).
- Reliability: "high" when the other person has ≥ 20 turns and responsiveness evidence ≥ 5; "medium" when the other person has ≥ 8 turns; otherwise "low".

The weights are ordered by theoretical importance but close to equal: responsiveness is the core mediator of the intimacy process (0.28); disclosure, reciprocity, positivity and engagement follow; linguistic coordination has the lowest weight (0.10) because the Chinese word list is approximate and the evidence comes from a single study. Without labeled data to fit, such "improper linear models" are more robust than subjective fine-tuning (Dawes 1979). The weights **have not been calibrated against real outcomes**.

### Long-term change

- **Gaps**: weeks without chats are kept as gaps and take no part in trend or change-point calculations.
- **Smoothing**: EWMA with $\lambda=0.3$; gap weeks carry the previous smoothed value.
- **Trend**: weighted least squares over the last ≤ 8 weeks with data, with weights $1/\max(4,\mathrm{SE}^2)$; the slope is in points per week, with an 80% interval; at least 4 weeks are required. "Rising" when the lower bound > 0 and the slope ≥ 1, "falling" when the upper bound < 0 and the slope ≤ −1, otherwise "stable".
- **Change points**: self-starting two-sided CUSUM ($k=0.5$, $h=3$), with the reference value being the mean since the previous change point (at least 2 weeks). The noise scale is $\sigma=\max(3,\ \mathrm{MSSD},\ 0.5\times\text{median SE})$, with MSSD estimated from week-to-week differences so that the change itself is not counted as noise. It needs at least 6 weeks with data; the start of a change is traced back to the first week of the consecutive same-direction deviation.
- **Phases**: split at change points, each with its average index and per-dimension means, listing up to 3 factors with the largest impact (impact = 100 × weight × change in the dimension; for friction, −30 × change in friction; only items with |impact| ≥ 0.5).

These are statistical descriptions, not conclusions about the relationship.

### Explainable evidence

Each dimension shows its definition, rule formula and research sources, in three columns:

- **Source facts**: rule-layer statistics and the corresponding original text. At most 6 items per dimension and at most 2 per type, so both positive and negative examples are visible.
- **AI quotes**: original text verified verbatim by the host, with an objective description.
- **AI inferences**: possible interpretations, confidence and alternative explanations, shown in a different style.

All original text can be opened with its surrounding context.

### Parameters

| Parameter | Value | Notes |
| --- | --- | --- |
| Turn merging / new segment | 3 minutes / 120 minutes | Same as the daily score |
| Unanswered threshold | 24 hours | Not counted in the responsiveness denominator |
| Shrinkage prior / strength | 0.5 / $k=4$ | Friction prior is 0 |
| Dimension weights | 0.28 / 0.18 / 0.16 / 0.14 / 0.14 / 0.10 | Responsiveness / disclosure / reciprocity / positivity / engagement / coordination |
| Saturation parameters | 0.6 (disclosure), 2 (positivity), 0.5 (bids) | Product settings |
| Friction discount / repair reduction | × (1 − 0.6F) / × (1 − 0.5ρ) | × 0.75 more if the AI says repaired |
| Boundary cap | 30 | Triggered only by the rule layer |
| AI pseudo-count / confidence weights | $m=4c$ / 0.5, 1, 1.5 | Low / medium / high |
| AI max shift / disagreement threshold | ±0.25 / 0.35 (and $n\ge3$) | |
| AI input | 80 messages/week, 300 characters/message | Temperature 0.1, 3500 tokens, 90 seconds |
| Interval | 80% (z = 1.2816) | |
| EWMA / trend window | λ = 0.3 / 8 weeks (at least 4) | |
| CUSUM | k = 0.5, h = 3, at least 6 weeks | σ ≥ 3 |
| LSM minimum length | 40 characters per side | Nine function-word categories |

### Limitations

- Text lacks tone, sticker meaning, voice and offline interaction; work contexts, dialects and irony can all be misjudged.
- The Chinese LSM uses an approximate function-word list without word segmentation.
- The weights, saturation parameters, shrinkage strength and shift limit are product parameters that have not been calibrated against real relationship outcomes.
- LLM ratings are stochastic and may differ between models.

For the full design, research sources and calibration plans, see [Relationship analysis v3 design](docs/AFFINITY-V3.md) (Chinese).

> Pages such as "每日历程" (daily timeline), "互动评分" (interaction scores), "评分规则" (scoring rules) and "打分依据" (scoring basis) still show the per-day "affinity-cue score v2.3". It is defined differently from the v3 index and should not be compared with it directly. The full formulas are in the [appendix](#appendix-affinity-cue-score-v23-still-used-by-the-daily-timeline-and-interaction-scores) at the end.

## Data and models

Chats, profiles, drafts and your self-profile are stored in the browser's local IndexedDB. When model replies, profile organizing, automatic history analysis or the AI analysis in "Relationship analysis" is started, the relevant chat context and data are sent to the model service configured in DSH. Automatic analysis can be paused or resumed in the status area. When profile sharing is on, a bounded snapshot of the current contact is held in host memory; it is revoked when sharing is turned off or the contact changes, and expires 60 seconds after syncing stops. The host does not write this snapshot to disk.

The import tool uses an in-memory queue; make sure it has been consumed before restarting, see [Import queue design](docs/IMPORT-QUEUE-DECISION.md) (Chinese). Backups contain chat data; store them carefully yourself. The repository contains no user chat exports, contact profiles, media, credentials or personal backups.

## Internationalization (experimental, navigation text only)

This README is available in Chinese, English and Japanese; the plugin UI itself is mainly in Chinese.

`locale/zh.json` and `locale/en.json` are generated by `build.mjs` from `textPairs` in `src/workspace.js`, and **currently cover only two items**: navigation names (`nav`) and the privacy notice (`privacy`, used for the module title/description).

- All other UI text, page titles and buttons are hard-coded in Chinese, with no English version.
- So there is no "full i18n" promise for now: in an English environment you will see English only in navigation and the module description; everything else stays Chinese.
- To extend it, add keys to `textPairs` and regenerate the locales (`pnpm run build`); don't edit the generated files by hand.

## Development and release history

See [CHANGELOG.md](CHANGELOG.md) (Chinese) for the full record.

| Date | Version | Highlights |
| --- | --- | --- |
| 2026-11-17 | Unreleased | Docs: the README scoring and analysis rules now follow relationship analysis v3 (formulas, indicators, weights and parameters matched to the code); v2.3 moved to an appendix |
| 2026-11-16 | Unreleased | Visual and layout refresh: relationship identity strip and pulse, icon navigation, bottom tab bar on phones, layered cards |
| 2026-11-16 | Unreleased | Relationship analysis v3: rule statistics + AI context ratings + long-term change + explainable evidence; new route `/affinity-analysis` |
| 2026-11-16 | Unreleased | DSH compatibility and responsive fixes: "☰ 列表" state on narrow screens, startup blocking on hosts without `subdsh`, DSH Web dark theme |
| 2026-11-16 | Unreleased | UI and interaction: unified visual layer, drag-and-drop import with identity preselection, bottom toast |
| 2026-11-07 | Unreleased | Scoring v2: effective-response union, per-turn de-duplication, small-sample scaling, explicit-boundary cap |
| 2026-11-05 | 3.3.0 | Two-level navigation, record-list search and pagination, "scoring basis" page, unified contrast and font sizes |

### Completed verification

- **2026-11-16**: the client builds successfully; 362 assertions across 54 test files pass, 0 fail. New coverage includes session layout state, host token adaptation, the sidebar fallback on hosts without `subdsh`, relationship analysis v3 (signals, model, fusion, long-term change, cache), the `affinity-analysis` route with quote validation, and icons. The plugin was also installed in the npm public DSH Web 0.2.2-rc.1, confirming route registration and that all four UI combinations of light/dark × PC/phone work.
- **2026-11-07** (scoring v2.1): the client builds successfully; 301 assertions across 46 test files pass, 0 fail. Coverage includes the effective-response union, same-turn de-duplication, small-sample scaling, neutral latency, explanations not escalating friction, the explicit-boundary cap, manual corrections, cross-midnight statistics, import, persistence, host APIs and packaging. New regression tests confirm that splitting messages does not inflate scores, and that outside pressure and conflict aimed at the other person are handled separately; the scoring-basis breakdown matches actual results.

Tests verify implementation behavior; they cannot prove that the rules accurately measure real affection.

## Appendix: affinity-cue score v2.3 (still used by the daily timeline and interaction scores)

This appendix describes the per-day "affinity-cue score v2.3". The main relationship metric is the [v3 index](#scoring-and-analysis-rules-relationship-analysis-v3) above. v2.3 is still used by pages such as "每日历程" (daily timeline), "互动评分" (interaction scores), "评分规则" (scoring rules) and "打分依据" (scoring basis), and its detection of the other person's turns and its manual corrections are also inputs to the v3 rule layer, so the full description is kept. The two are defined differently and should not be compared directly.

The affinity-cue score is computed by local rules without calling a model, and can be checked item by item (the "评分规则" (scoring rules) and "打分依据" (scoring basis) pages match this section). The current formula is v2.3 (since 2026-11: question cap +10, self-disclosure cap +12, and a separate bonus of up to +4 for explanations after friction; the v2.1 caps of 8/10 are no longer used).

This score summarizes observable communication cues; it is not the probability that the other person likes you. Research on response quality, self-disclosure and conflict recovery was used to choose the signals. The numeric weights below, the 32-point reference point and the sample thresholds are product rules and have not been calibrated with emotion-labeled data. For sources, scope and design trade-offs, see [Scoring research notes](docs/SCORING-RESEARCH.md) (Chinese). After an upgrade, historical curves are recomputed under the new rules; scores from old and new rules should not be compared directly.

### Formulas

$$
S_0=\mathrm{clamp}\!\left(\mathrm{round}(38+W+I-C-T+R),0,100\right)
$$

Let $T_t,T_s$ be the scorable turn counts of the other person and myself, and $n_q,n_{\mathrm{sh}},n_{\mathrm{emo}},n_{\mathrm{bnd}}$ the number of the other person's turns containing a question, a disclosure, a personal-feeling disclosure, and an explicit negative or boundary. Feeling disclosure is a subset of disclosure, so $n_{\mathrm{emo}}\le n_{\mathrm{sh}}$. Each signal type counts at most once per turn, and manually excluded evidence is not counted; the UI still keeps per-message evidence for review.

Positive expressions are classified per message: ordinary politeness or emoji weighs 1, support or specific thanks directed at me weighs 4, and direct closeness weighs 6. Let $p_t$ be the highest weight among non-excluded positive expressions in the other person's turn $t$, or 0 if none; thanks and closeness in the same turn do not stack. The positive-expression count in the UI includes politeness and cannot be read as the number of closeness expressions.

$n_{\mathrm{resp}}$ is the union of turns with an effective answer, an accepted suggestion or a topic follow-up; a turn that is both an answer and a follow-up counts once. Turns that still carry non-excluded friction or explicit negative evidence do not earn the effective-response bonus.

$$
\begin{aligned}
P&=\min(18,\sum_t p_t),\quad Q=\min(10,2n_q)\\
H&=\min(12,2.5n_{\mathrm{sh}}+1.5n_{\mathrm{emo}})\\
A&=\min(12,12n_{\mathrm{resp}}/\max(4,T_t))\\
W&=\min(45,P+Q+H+A)
\end{aligned}
$$

Let $a_t,a_s$ be the number of conversation segments each side initiated, $n_{\mathrm{perf}},n_{\mathrm{low}}$ the number of perfunctory and low-information turns, $n_c$ the number of friction turns, $n_{\mathrm{rep}}$ the number of the other person's explanation or reconciliation turns, and $G$ the condition that at least two of the other person's friction turns occur in the same segment.

$$
\begin{aligned}
I&=\begin{cases}4a_t/(a_t+a_s+4),&T_t>0\land T_s>0\\0,&\text{otherwise}\end{cases}\\
E&=T_t>0\ ?\ \min(1,(n_{\mathrm{perf}}+n_{\mathrm{low}})/T_t):0\\
C&=\min(60,24n_{\mathrm{bnd}}+\mathrm{round}(16E))\\
T&=\begin{cases}\min(24,12n_c),&G\\\min(8,8n_c),&\text{otherwise}\end{cases}\\
R&=\min(4,2n_{\mathrm{rep}})
\end{aligned}
$$

| Item | Rule |
| --- | --- |
| Base | 38 |
| Positive expression P | Only the strongest level per turn: politeness/emoji +1, support/specific thanks +4, direct closeness +6; total at most +18 |
| Questions Q | +2 per turn, at most +10 |
| Self-disclosure H | +2.5 per disclosure turn, +1.5 more for feeling disclosure; disclosure total at most +12 |
| Effective response A | 12 × effective-response turns ÷ max(4, other person's turns), at most +12; the four positive items together at most +45 |
| Explanation and reconciliation R | +2 per turn, at most +4 |
| Negative or boundary | −24 per turn; with an explicit negative or boundary the final score is at most 32 |
| Perfunctory and low-information | Share of the other person's turns × 16, rounded and deducted; only one type per turn; together with negatives at most −60 |
| Reply latency and message-count imbalance | Kept as statistics, no direct addition or deduction; zero turns or a single reply from the other person is not penalized on its own |
| Initiation I | Added by the ratio above when both sides have turns, cap below 4; no deduction for initiating less |
| Ordinary friction T | At most −8 |
| Strong friction T | At most −24, final score capped at 48; explanations neither increase the penalty nor trigger strong friction |

Consecutive messages from the same person no more than 3 minutes apart are merged into one turn.
A first message, or a gap of 120 minutes or more since the end of the previous turn, starts a new conversation segment.
Reply latency is measured from the last message of my merged turn to the first message of the other person's reply turn.
The full timeline is analyzed first, then initiations, answers and latencies are assigned to the date they occurred. Midnight splits daily turns but keeps the context of the same segment.
Times without a time zone are interpreted as Shanghai time; Unix seconds/milliseconds and times with explicit zones are converted before sorting.
Strong friction requires at least two of the other person's friction turns in the same segment.
Explanations are kept as checkable context cues; they are not treated as new friction, nor as reconciliation by themselves.
When comparable times are missing, items are handled separately to avoid inferring continuous conflict.
Friction, explanation or explicit-negative turns are not double-counted as perfunctory or low-information.

Questions are judged per clause; polite thanks do not mask an actual question in another clause.
Manual corrections cover ten types: question, disclosure, positive, negative, perfunctory, low-information, friction, explanation, answer or accepted suggestion, and follow-up or added information.
Turn signals show the first original message; a correction stores the turn's members and their original text. When earlier messages are added later, the correction stays linked to the original evidence; a new independent match or a change in source text triggers re-evaluation, and restoring is supported.
Message-level corrections also store a snapshot of the original text; if the text under the same message ID changes, the exclusion made for the old text is not carried over.

On a day with records, if $T_t=0$ or $T_s+T_t<4$, and there is no positive, question, disclosure, effective response, negative, friction, perfunctory or low-information signal, $S_0$ is overridden with 32 and the result is $S_1$; otherwise $S_1=S_0$. The low-frequency condition uses merged turn counts for both sides, so splitting one reply into several messages does not lift the override.

When the other person has fewer than six turns, only the part above 32 is scaled by sample size:

$$
S_2=\begin{cases}
\mathrm{round}(32+(S_1-32)\min(1,T_t/6)),&S_1>32\\
S_1,&S_1\le32
\end{cases}
$$

Finally, if $G$ holds then $S=\min(S_2,48)$; otherwise $S=S_2$. If $n_{\mathrm{bnd}}>0$, also apply $S\leftarrow\min(S,32)$. An explicit refusal is not masked by other bonuses, and negative scores below 32 are not raised because of a small sample. 32 is the display reference point when evidence is lacking; it does not mean 32% affection. Dates with no records at all are shown as gaps.

### Context and engagement

When the reply is only "随便你" (whatever you like), "都行看你" (anything, up to you) or "你看着办" (you decide), letting me choose is treated as neutral; in other cases the text is kept for review. Crossing segments does not by itself trigger a friction deduction; independent explicit accusations and requests to stop contact are still detected separately.

Scoring excludes system messages, non-text media records and placeholder-only text. Media stays in the original chat view; who initiated is not inferred from file names, call placeholders or system notices, and image content is not read.
Natural colloquial disclosure covers expressions such as "我俩吃了" (we two ate), "我老看" (I keep watching) and "我就记得" (I just remember).
Sentences asking the other person to do something are excluded from both disclosure and positive detection; independent personal experiences or positive expressions in the same message are kept.
"没有没有" (no, no) and sentences asking about a third person are not counted as questions to me.
First-person actual feelings (such as happy, sad, nervous) can count as feeling disclosure; quotes, instructions to others and hypotheticals do not. The valence or intensity of a feeling earns no extra points. A polite request to stop contact is still an explicit boundary; reassurance that negates rejection, such as "不是不喜欢你" (it's not that I don't like you), is not judged as rejection.

Short replies are judged against the previous turn's question, suggestion and adjacent topic. Short sentences that answer a question, accept a suggestion, add a specific evaluation or follow up a topic become effective-response candidates. A single acknowledgement or laugh is neutral; the short-reply penalty applies only when three consecutive turns of the other person lack an effective response. Normal busyness, going to sleep, good night and ending the current chat are neutral and do not add to the consecutive count. Complaints about outside pressure such as work, clients or devices are not relationship friction unless worded at me.
When the other person answers my previous turn directly, the context of that turn is kept for answer and follow-up detection even if more than two hours passed; the two-hour segmentation is still used for initiation and same-segment friction statistics.
Answer, accepted-suggestion and follow-up indicators can be expanded to the original text, excluded and restored.
Time, place, quantity and yes/no questions are each matched to answer features, and checked against detected event actions.
For example, if I ask when they left home, the time they bought a phone in the reply is not counted as an answer, while an independent short time answer is kept.
Topic follow-up requires a lexical link or a related topic; isolated phrases such as "人多" (crowded) or "美味" (tasty) and endings with "的" do not match directly.
If I shared a feeling or good news in the previous turn and the other person responds with understanding, support or congratulations that fit that context, it can count as a follow-up signal. It uses the follow-up correction mechanism and joins the effective-response union, without a separate duplicate bonus. Generic praise without context is not automatically upgraded to a supportive response.

The interaction-metrics page shows the engagement score and the positive-expression count separately. The engagement score uses the same formula with the positive-wording item set to zero, keeping behavioral cues such as answers, questions, disclosures and turns.
Positive expressions are listed separately with evidence and level labels. The existing affinity-cue fields and charts keep using the score that includes the positive item.
Scenes are detected by rules as work, daily, mixed or unclassified, and the initiation count and per-scene results are shown for each.
Scene labels are for review; the composite weights are not yet differentiated by scene. Per-scene results aggregate whole conversation segments, keeping ordinary replies in their segment. Segments that match neither work nor daily words are unclassified.

| Displayed item | Computation scope |
| --- | --- |
| Interaction engagement score | All scorable text of the selected pair, recomputed with the positive-wording item set to zero |
| Positive-expression count | The other person's messages matching the positive lexicon and not manually excluded, including politeness, support and direct closeness |
| Answered-question / topic-follow-up turns | Detected with the previous turn's context; can be checked and corrected one by one |
| Average engagement score | Simple average of engagement scores over valid record days |
| Daily affinity-cue score and trend chart | v2.3 score including the positive item; monthly/yearly weighted by turns |
| Per-scene engagement score | Work, daily and mixed segments each rescored |

For the same records, the whole-record score, the simple daily average and the monthly/yearly weighted score use different aggregation scopes; check the page labels when comparing. Rule-based categories such as "low-information" and "work" can be checked against the original text.

### Monthly and yearly aggregation

$$
w_d=\max(1,T_t^{(d)}),\quad
R=\sum_d T_t^{(d)},\quad
\bar S=\frac{\sum_d S_dw_d}{\sum_d w_d}
$$

$$
M=\begin{cases}
\mathrm{round}(32+(\bar S-32)R/20),&R<20\land\bar S>32\\
\mathrm{round}(\bar S),&\text{otherwise}
\end{cases}
$$

The weight sum and the other person's actual total turns $R$ are counted separately. A record day where the other person had zero turns has weight 1 but does not increase $R$. Months and years both use the same 20-turn scaling threshold. Here $S_d$ is already small-sample scaled per day; the second monthly/yearly scaling is a separate conservative aggregation rule, not a statistical confidence interval.

## Maintenance and license

- [3.1.1 review fixes and feature suggestions](docs/archive/reviews/REVIEW-20261101.md) (Chinese)
- [Architecture and maintenance boundaries](docs/ARCHITECTURE.md) (Chinese)
- [Host API](docs/HOST-API.md) (Chinese)
- [Relationship analysis v3 design](docs/AFFINITY-V3.md) (Chinese)
- [Unified roadmap](docs/IMPLEMENTATION-ROADMAP.md) (Chinese)
- [Third-party project evaluation](docs/THIRD-PARTY-EVALUATION.md) (Chinese)
- [Known issues](docs/KNOWN-ISSUES.md) (Chinese)
- Historical backups and verification logs are archived in `docs/archive/` (`backups/`, `reviews/`, `logs/`, `legacy/`). They are historical material only and take no part in builds or tests.

The main code is under the MIT License; PDF.js is under its Apache 2.0 license, see `PDFJS-LICENSE.md`. The reply principles draw only on general communication methods and include no original Tong Skill material or persona voice.
