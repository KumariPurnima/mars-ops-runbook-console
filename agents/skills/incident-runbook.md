# incident-runbook

Turn a triage diagnosis into an executable, approval-gated runbook.

## Rules

- Read actions may run autonomously
- Writes (rollback, scale, secret changes, traffic shifts) require Action Gateway approval
- Destructive filesystem commands are denied — propose safer alternatives
- Always draft a status note and postmortem skeleton before closing the loop

## Output

Structured steps with owners, risk, and approval state — plus a postmortem draft
a human can edit in under five minutes.
