# Cypress authentication QA runner — Step 4

Runs the unchanged, approved SEED-1 Gherkin against sut-python and sut-node. The official Gherkin parser reads the pinned feature; each step must have an exact implementation. Original story/AC tags and scenario names become test titles. Three scenarios per SUT produce six real Cypress passes. There is no test healing, runtime AI, tracker or campaign orchestration.

## Setup

Use native Node 26 (or supported Node 22/24) and Python 3.11+ for the separate development harness. package-lock.json pins every Node dependency. Dependencies may be installed with npm ci in a normal checkout. For an audited development checkout, install outside the repository to avoid auditing dependency symlinks:

```sh
mkdir -p /tmp/qa-cypress
cp package.json package-lock.json /tmp/qa-cypress/
npm ci --ignore-scripts --prefix /tmp/qa-cypress
node /tmp/qa-cypress/node_modules/cypress/bin/cypress install
export QA_CYPRESS_MODULE_DIR=/tmp/qa-cypress/node_modules
python3 -m venv .venv
.venv/bin/pip install -r harness/requirements.txt
.venv/bin/python tools/bootstrap_features.py
```

The relative submodule URL is ../qa-features.git. The offline Git bundle bootstraps a detached approved checkout without enabling file transport. The clean HEAD, staged gitlink and feature-ref.txt must match. No parent untracked files are needed for the runner or its native adapters.

Start both SUTs separately. Set QA_SUT_PYTHON_REVISION and QA_SUT_NODE_REVISION to actual immutable source commits or image SHA-256 values (hex only). Optional QA_SUT_PYTHON_URL / QA_SUT_NODE_URL default to localhost:8001 and localhost:8002. QA_NODE_BINARY can select an absolute native Node binary when the shell and subprocess PATH select different architectures.

```sh
.venv/bin/python tools/verify.py --check 6-passes
.venv/bin/python tools/verify.py --check result-schema
```

For one slot, set QA_SUT to sut-python or sut-node, QA_RESULT_DIR to a fresh absolute reports/ subdirectory, and run node tools/run.cjs. Existing executions cannot be overwritten. Cypress 16 uses Cypress.expose for the public synthetic contract, with no deprecated Cypress.env calls.

## Assertions and evidence

Registration uses a fresh UUID identity. The immutable baseline is read-only. Label/role/data-testid selectors come exclusively from selectors.json; semantic translation supplies no alternate test selectors. AC-1/2 assert exact user shape, JWT shape, authenticated GET /user, browser storage and protected identity. AC-3 independently asserts the 422 response, exact UI error, empty cookies/storage and protected-route denial. Unauthenticated Hurl GET /user remains independently verified by Step 2.

cy.intercept observes real requests with req.continue; it does not supply stub responses. Only sanitized method/path/status/authorization-presence projections are recorded. Response bodies remain in memory for assertions. Video and failure screenshots are disabled. No raw request logs, cookies or tokens are stored in the result artifacts. Observer states are complete, partial, unavailable and error; non-complete states cannot PASS.

The reporter reconciles actual Cypress test outcomes with submitted observations, then emits the shared results.schema.json, hash-bound network/check artifacts and immutable runner/SUT/feature provenance. The verifier checks both schema and semantic integrity, rejects tampered evidence, and runs live observer fault cases. Signed harness receipts bind exact result hashes; gates revalidate the current artifacts.

Development checks use harness/scripts/preflight.py, verify_step.py run --check 6-passes, verify_step.py run --check result-schema, verify_step.py validate, verify_step.py gate, and scope_guard.py against the retained baseline. Operator-owned QA_AUTHORIZATION_FILE and QA_EVIDENCE_KEY_FILE are required for writable development activation. The frozen canonical harness is untouched; the local controller extension and exact hashes are recorded in governance/. Runtime reports stay in the scope audit and are excluded only from source hashing.

Claude remains artifacts-only; live Claude is NOT RUN. This repository stops at Step 4. Steps 5–7 require separate authorization.

Implementation references: [Cypress configuration](https://docs.cypress.io/app/references/configuration), [TypeScript support](https://docs.cypress.io/app/tooling/typescript-support), and [Cypress 16 environment migration](https://docs.cypress.io/app/references/migration-guide).
