# Skill: Workflow Automation

Identify a repeated manual sequence and turn it into a reliable, low-touch routine.

- **Trigger:** "Automate / streamline how I do X."
- **Inputs:** the current manual steps; the tools involved (MCP connectors, scripts).
- **Output:** a documented workflow in `Workflows/` and, where possible, an
  agent-runnable procedure or script.

## Steps
1. Write down the current steps exactly as done today.
2. Find the friction: handoffs, copy-paste, lookups, repeated decisions.
3. Decide what the agent can own vs. what needs a human checkpoint.
4. Encode the procedure in `Workflows/`; reference templates and connectors.
5. Run it a few times; tighten based on failures.

## Quality bar
- The routine is documented well enough that the agent can run it from the doc.
- Human checkpoints are explicit where judgment or external sends are involved.
