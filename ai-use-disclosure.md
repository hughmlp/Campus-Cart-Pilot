# AI-Use Disclosure (draft)

## Tools used
Claude Code (Claude models) for coding and documentation help in this revision. Replit and its AI assistant for building and hosting the original prototype. OpenAI models through Replit AI Integrations inside the product.

## Development assistance
AI helped plan the revision from the peer feedback, write the OpenAPI changes, database columns, the intake endpoint, the React screens, the fallback text-matching function, and the first draft of these documents. It also ran the typecheck and a small script against the fallback function.

## Representative prompts
1. "Use the peer feedback and the assignment to choose two or three improvements." It proposed the intake, saved-sentence and edit-or-reject changes. I kept them and decided not to block vague requests.
2. A request to write the intake endpoint. It produced a model call plus a fallback. I required that unstated budgets and merchants stay blank and that the interface label the source.
3. A request to draft the test table. It could not run the live model, so I kept those results marked as pending instead of filling them in.

## Human judgment
I rejected making submission impossible for vague items, because a research pilot should record vague requests too. I also rejected filling the test table with expected results written as if they had happened.

## Verification
Typecheck passes across the workspace. The fallback function was run on five inputs. Still to check by me: the live model output, the full flow in the browser, the dashboard and CSV with the new columns, and the database change on the deployed app.

## AI inside the product
Task: suggest item, category, merchant and budget from one sentence, and ask a clarifying question when the item is vague. Input: the participant's typed or transcribed sentence (up to 240 characters). Output: suggested fields the participant must check and can edit or reject. Status: live when the Replit OpenAI integration is configured, otherwise a labeled text-matching fallback. Voice transcription is live. The purchasing agent is not built.
