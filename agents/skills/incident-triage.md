# incident-triage

Correlate pager alerts, metrics, logs, and recent deploys into a single working
diagnosis. Prefer evidence over speculation. Never mutate production.

## Tooling

- Query metrics with short windows first (5–15m)
- Search logs for the top error signature
- List recent deploys / canaries for the service
- Call Serverless Inference only for synthesis, not as a substitute for data

## Output

Write a short hand-off the runbook agent can execute without re-asking the human.
