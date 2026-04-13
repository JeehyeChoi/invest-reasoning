# Repo Roles

## 1. geo-portfolio (A: Baseline)
Core application and primary development history.

- Contains the main product code
- Serves as the reference implementation
- No experimental scaffolding (orchestration/harness) included

---

## 2. geo-portfolio-orch (C: Orchestration)
Experimentation with orchestration-driven development.

- Focus: workflow orchestration patterns
- Includes orchestration layers, pipelines, and execution control
- Used to evaluate structured multi-step generation approaches

---

## 3. geo-portfolio-harness (D: Harness)
Experimentation with harness-based development.

- Focus: test-driven / harness-constrained generation
- Includes evaluation harness, constraints, and feedback loops
- Used to measure reliability and controllability

---

## 4. geo-portfolio-lab (Meta)
Research logs and cross-approach analysis.

- Experiment logs (runs, failures, observations)
- Comparisons between A / C / D
- Methodology notes and learnings
- NOT a codebase — documentation only


## Experiment Axes

- A: Manual / baseline development
- C: Orchestration-based generation
- D: Harness-based generation

Goal:
Compare development speed, correctness, and maintainability.
