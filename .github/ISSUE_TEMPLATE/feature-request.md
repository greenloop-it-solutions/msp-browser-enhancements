---
name: Feature request
about: Suggest a new userscript, or a new feature for an existing one
title: '[feature] '
labels: enhancement
assignees: ''
---

> **Before you post:** do not include client names, organization or tenant IDs, ticket
> numbers, internal hostnames, or credentials. Describe the shape of the problem, not the
> specific customer record.

## Target application

<!-- Rewst, Empath, ConnectWise, IT Glue, Microsoft 365, other. -->

## Is this a new script or a change to an existing one?

- [ ] New userscript
- [ ] New feature in an existing script — which one:
- [ ] Make an existing hard-coded value configurable — which one:

## The problem

<!-- What is tedious, slow, or error-prone in the application today? -->

## The proposed behavior

<!-- What should the script do instead? Be specific about when it should trigger. -->

## Pages it should apply to

<!--
Match patterns, as narrow as possible. For example:
  https://app.rewst.io/organizations/*/form/*

Broad patterns such as *://*/* are not accepted.
-->

## Pages it should NOT apply to

<!-- Any `@exclude` entries needed. -->

## The elements involved

<!--
Optional but very helpful. Right-click the relevant control -> Inspect, and paste the
element's tag, `data-*` attributes, id, ARIA role, and class list.

Prefer stable identifiers: data-* attributes, IDs, ARIA roles, then framework classes
such as .MuiAutocomplete-listbox. Generated classes like css-19cnjtd change on every
build of the application and cannot be relied on alone.
-->

```html
```

## Does this need extra permissions?

- [ ] No — it only reads and modifies the page (`@grant none`)
- [ ] Yes — it needs to store settings, make requests, or similar. Explain what and why:

## Anything else

<!-- Mockups, links to the application's docs, or how often this comes up. -->
