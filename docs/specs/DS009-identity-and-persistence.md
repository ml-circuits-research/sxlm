---
title: DS009-identity-and-persistence
summary: Defines sealed executable identity, model-bound snapshots, content-addressed registries and serialized writers.
---

## Introduction

Integrators must be able to identify exactly which host and knowledge produced a result. Persistent state must not silently move to a different model, and concurrent coding agents must not overwrite each other's promotions.

## Core Content

### Executable identity

Model identity must bind the ordered [pack](../wiki.html#definition-pack) manifests, static local model import closure, Node component versions, platform and architecture. Primitive-dependent [circuits](../wiki.html#definition-circuit) must bind native implementation identity. The chart callback must also bind the complete model, including [circuit](../wiki.html#definition-circuit)-produced [grammar](../wiki.html#definition-grammar) and semantic actions.

Executable hashing must preserve property enumeration order and signed zero. Structural evidence hashing may canonicalize these distinctions, but it must not be substituted for executable [pack](../wiki.html#definition-pack) addresses, cache identity or exact reproduction. Recursively frozen owned subtrees may share cached hashes. Shallow freezing by an external caller is insufficient evidence of immutable ownership.

The static source profile must reject dynamic loading and symlinked dependencies. It supports single-line static local `.mjs` imports and Node built-ins. Source bytes are captured when the module closure loads. Subsequent model construction after a source edit must require a process restart; already loaded code must not be relabeled with new disk bytes.

This identity is a trusted-process reproducibility contract. It is not hostile-host attestation, a general JavaScript dependency parser, a JavaScript sandbox or protection from arbitrary monkey-patching by code that controls the process. Raw `CircuitRuntime` users outside `SymbolicModel` must supply and maintain an implementation identity; its unversioned default must remain explicit.

### Sealing and sessions

Installed models, programs, operation contracts and resources must be immutable under their identities. Inspection getters must return detached maps or frozen values. Editing an inspection result must not rebind installed behavior. Public execution results and snapshots must be detached from internal/cache state.

A [session](../wiki.html#definition-session) snapshot must use `sxlm.session.v1`, include its exact model hash and contain a `sxlm.world.v1` state. Restoration must reject a different model identity. Snapshots are trusted application persistence and are not a signed external attestation of fact provenance. [Session](../wiki.html#definition-session) reset must restore a copy of the [circuit](../wiki.html#definition-circuit)-produced initial state. DS005 governs atomic turn updates.

### Registry storage

The CLI registry defaults to `.sxlm`, with `--registry` selecting an explicit directory. `active.sop` must bind the [bootstrap](../wiki.html#definition-bootstrap) [pack](../wiki.html#definition-pack), ordered extension hashes, model hash, previous state and validation identity. Extension [packs](../wiki.html#definition-pack) must be stored under content-addressed `.sop` paths, with retained [receipts](../wiki.html#definition-receipt) and lineage history. Loading must validate [pack](../wiki.html#definition-pack) contents and reject [bootstrap](../wiki.html#definition-bootstrap) or model mismatch.

[Promotion](../wiki.html#definition-promotion) and rollback must use exclusive creation of `write.lock` to serialize writers. The lock records the writer PID and start time. Ordinary success and rejection must release it. After a crashed writer, an operator must inspect the recorded process before removing a stale lock. The contract does not provide a distributed consensus service.

Atomic [SOP](../wiki.html#definition-sop) replacement must write a unique temporary file and rename it to its destination. Activation must not trust an old [receipt](../wiki.html#definition-receipt) without revalidation against the actual parent. Rollback must recompute the restored model from the stored [packs](../wiki.html#definition-pack). No automatic migration is promised across incompatible source, [bootstrap](../wiki.html#definition-bootstrap) or identity changes.

### Verification

`test/identity.test.mjs` must check relocation, fresh-process stability, changed native semantics, changed executable literals, snapshot rejection and refusal to relabel already loaded code. `test/workflow.test.mjs` must check [promotion](../wiki.html#definition-promotion), reload, rollback and concurrent-writer refusal. Standalone execution must confirm that relocation does not depend on sibling directories or workstation paths.
