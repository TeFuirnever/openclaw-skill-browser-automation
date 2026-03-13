## Description of Changes
Briefly describe the changes you've made in this pull request. Include:

- What was changed and why
- How it addresses the related issue (if applicable)
- Any breaking changes or migration notes

## Related Issue
Closes #<issue_number>
(or relates to #<issue_number>)

## Type of Change
Please mark the relevant option with an `x`:

- [ ] **Bug fix** (non-breaking change which fixes an issue)
- [ ] **New feature** (non-breaking change which adds functionality)
- [ ] **Breaking change** (fix or feature that would cause existing functionality to not work as expected)
- [ ] **Documentation update** (changes to docs only)
- [ ] **Refactoring** (code quality improvements, no functional changes)
- [ ] **Performance improvement** (code changes that improve performance)
- [ ] **Tests** (adding or updating tests, no production code changes)
- [ ] **Other** (please describe)

## Testing Checklist
Please confirm that you have:

- [ ] Added unit tests for new functionality
- [ ] Added integration tests where applicable
- [ ] Updated existing tests if needed
- [ ] Manually tested the changes in a real environment
- [ ] Tested on multiple Node.js versions (18.x, 20.x)
- [ ] All existing tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

## Code Review Checklist
Please confirm that your code follows these standards:

- [ ] Code follows the project's style guide and linting rules
- [ ] Self-review of the code has been completed
- [ ] Comments have been added for complex logic
- [ ] Documentation has been updated (README, API docs, etc.)
- [ ] No console.log statements left in production code
- [ ] No hardcoded configuration values or secrets
- [ ] Error handling is appropriate and complete
- [ ] Dependencies are properly declared in package.json

## Additional Notes
Any additional context, screenshots, or information that would help reviewers understand and evaluate your changes.

## Breaking Changes / Migration Guide
If this PR includes breaking changes, please provide a migration guide for users:
<!-- Describe breaking changes and how users should migrate -->
