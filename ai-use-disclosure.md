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
Task: hold a short conversation that collects the item, a maximum budget and an optional store, asking one question at a time and inferring the category. Input: the conversation so far (typed or transcribed speech) and the draft collected so far. Output: an updated draft and the next question, which the participant must check on a review screen and can edit or reject. Status: live when the Replit OpenAI integration is configured, otherwise a labeled rule-based fallback that asks the same questions. Voice transcription and spoken replies (text-to-speech) are live and run the conversation hands-free. The purchasing agent is not built.


A user test of the first version said choosing a category, store and budget in separate fields was too much work, so I replaced the form with a conversation. I kept the server in charge of deciding when the draft is complete, because I did not want the model to be able to skip the budget or invent one.

Testing on my own devices showed a bug I introduced: I gave the speech-to-text model an example sentence as a hint, and on a laptop microphone it sometimes copied that sentence or returned "running socks" instead of what I said. I removed the hint. I only found this because I tested with real speech on a second device, which is a check AI-generated code does not do for you.
