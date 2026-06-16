# Prompt Library

A collection of 10 reusable prompt templates for common dev tasks. Replace anything in `{curly braces}` with your specifics.

---

## 1. Code Generation

```
Create a {language} {component type} that {does X}, following {framework/style} conventions. Output only code, no explanations.
```

**Use when:** You need a new file/component/function from scratch and already know roughly what you want.

---

## 2. Bug Fix

```
This code throws the error: {error message}.

Relevant code:
{code}

Fix it and explain the root cause in 1-2 sentences.
```

**Use when:** Debugging — always paste the exact error message, not a description of it.

---

## 3. Explain Code

```
Explain what this {language} code does, focusing on {specific concern, e.g. edge cases / performance / control flow}:

{code}
```

**Use when:** Onboarding onto unfamiliar code, or reviewing someone else's PR.

---

## 4. Refactor

```
Refactor this code to {goal, e.g. improve readability / reduce duplication / improve performance} without changing its behavior:

{code}
```

**Use when:** Cleaning up working code without risking functional changes.

---

## 5. Few-Shot Pattern Matching

```
Follow this pattern:

{example 1}
{example 2}
{example 3}

Now apply it to:
{new input}
```

**Use when:** You need consistent formatting/style across many similar items (e.g. converting text, generating commit messages, writing docstrings).

---

## 6. Summarize

```
Summarize {document/text} in {N} sentences for an audience of {audience}.
```

**Use when:** Condensing long docs, articles, or meeting notes into something shareable.

---

## 7. Test Generation

```
Write unit tests for this function using {testing framework}, covering normal cases, edge cases, and error cases:

{code}
```

**Use when:** Adding test coverage to existing code.

---

## 8. API Design

```
Design a REST API for {resource}, with routes for {operations}.
Specify for each route: method, path, request body, and response shape.
```

**Use when:** Planning backend endpoints before writing implementation code.

---

## 9. Code Review

```
Review this {language} code for {bugs / performance / readability}.
List issues as a table: Issue | Severity | Suggested fix.

Code:
{code}
```

**Use when:** Getting a quick second opinion before a human review.

---

## 10. Step-by-Step Plan

```
Break down the task "{task}" into a numbered list of steps a {role} would follow, each step 1 sentence.
```

**Use when:** Planning a project, feature, or workflow before diving into execution.

---

## Notes / Anti-Patterns to Avoid

- ❌ Vague asks ("make this better") → ✅ specify the goal and constraints
- ❌ No context given → ✅ paste relevant code/error/data
- ❌ Asking for too much in one prompt → ✅ break into focused steps
- ❌ No output format specified → ✅ state format explicitly (code only, table, bullet list, etc.)
- ❌ No examples for pattern-based tasks → ✅ use few-shot examples (see Template 5)
