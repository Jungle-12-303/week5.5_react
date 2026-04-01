# Architecture Review

- Date: 2026-04-02
- Reviewer lens: `architecture-review`
- Scope: current `mini-react` project on branch `codex/departure-board`

## Overall Verdict

The project still has a clear learning-oriented core around `virtual-dom -> diff -> commit`, but the newer function component and hooks layer currently sits beside that core rather than extending it through a single rendering model. This is acceptable for short-term demos, but it will become expensive if the team wants reusable stateful components beyond the root wrapper pattern.

## Top Architectural Findings

### 1. Two component execution models coexist

The current architecture has two different ways to execute components.

- `h()` creates `COMPONENT` VNodes for function types.
- `diff()` and `createRealNode()` immediately resolve those component VNodes as pure functions.
- Hooks rely on `FunctionComponent` instances plus the global `currentComponent` render context.

This means stateful hooks work only through the explicit `new FunctionComponent(...).mount()` path used in the hooks demo, not through the normal `h(MyComponent)` tree path.

Relevant files:

- [h.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/h.js)
- [function-component.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/function-component.js)
- [hooks.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/hooks.js)
- [create-real-node.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/create-real-node.js)
- [diff.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/diff.js)

Architectural impact:

- The system boundary for “component” is unclear.
- Nested stateful function components are not naturally supported by the same model.
- Future extension will likely require redesign, not incremental evolution.

### 2. Reconciliation depends on renderer-side component resolution

`diff.js` imports `resolveComponentVNode()` from `create-real-node.js`.

That creates a boundary leak:

- component resolution logic lives in the DOM creation layer
- reconciliation depends on that DOM-side module
- the same conceptual responsibility is split across multiple files

Architectural impact:

- tree normalization, reconciliation, and DOM materialization are not cleanly separated
- future rule changes around component resolution will likely require touching several layers together

Relevant files:

- [diff.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/diff.js)
- [create-real-node.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/create-real-node.js)

### 3. Public API and documentation are out of sync

The exported surface now includes hooks, debug APIs, and `FunctionComponent`, but the README still describes the project mainly as the original VDOM/diff/commit learning core and still says hooks are outside the current scope.

Relevant files:

- [index.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/index.js)
- [README.md](/D:/03Dev/05Jungle/mini_react/mini_react/README.md)

Architectural impact:

- teammates cannot easily tell what is stable core vs. experimental layer
- review and extension decisions become inconsistent
- project boundaries exist in code but not in shared documentation

## Assumptions And Unknowns

- This review assumes the project remains a learning-focused mini-react rather than a production framework.
- If the team intentionally wants hooks to work only at the root wrapper layer, the first finding may be an accepted short-term tradeoff.
- The README contains visible encoding issues, so some intended documentation meaning may be harder to verify precisely.

## Immediate Actions

1. Decide whether the team wants one unified component execution model or a deliberately limited root-only hooks model.
2. Move component resolution into a neutral layer that both diffing and DOM creation can depend on without crossing boundaries.
3. Update the README to reflect the actual exported and supported architecture, especially hooks, debug APIs, and function component support.

## Longer-Term Improvements

1. Separate the architecture into explicit stages: component evaluation, tree diffing, and DOM commit.
2. Introduce a clearer ownership model for component instances and hook state if nested stateful components are part of the roadmap.
3. Distinguish stable core APIs from experimental or demo-oriented layers in both code exports and project documentation.

## Suggested Follow-up Issues

- Unify component execution model for VNode components and hook-driven components
- Extract component resolution into a renderer-independent module
- Align README scope and architecture description with current exports
