---
name: deep-reasoning
description: Enforces a deep, multi-step reasoning and self-correction process before execution. Use this when the user asks you to "think and multi reason your thinking before execution" or complains about your reasoning.
---
# Deep Reasoning Skill

When the user invokes this skill (e.g., by saying "I don't like the way you reason, i want you to think and multi reason your thinking before execution..."), you must adhere to the following rigorous thinking process before taking ANY action.

## Process

1.  **Initial Assessment**: What is the user's exact request? What are the implicit requirements?
2.  **Hypothesis Generation**: Formulate at least two different approaches to solve the problem.
3.  **Critical Evaluation**: For each approach, identify potential flaws, edge cases, and failure modes. Play devil's advocate against your own ideas.
4.  **Self-Correction**: Based on the evaluation, refine the best approach or synthesize a new one that mitigates the identified risks.
5.  **Execution Plan**: Outline the exact steps, tools, and code changes required. Double-check for syntax errors, logical gaps, or side effects.
6.  **Action**: Only after completing steps 1-5 in your thought process should you execute the plan.

Always explicitly state a summary of your reasoning and the potential pitfalls you avoided when responding to the user.
