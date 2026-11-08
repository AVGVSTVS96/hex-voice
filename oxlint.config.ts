import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';
import antiSlop from 'ultracite/oxlint/anti-slop';
import core from 'ultracite/oxlint/core';
import react from 'ultracite/oxlint/react';
import reactNative from 'ultracite/oxlint/react-native';

type ImportRule = Extract<
  NonNullable<NonNullable<OxlintConfig['rules']>['no-restricted-imports']>,
  unknown[]
>;
type ImportOptions = Extract<ImportRule[1], { paths?: unknown }>;

const restricted = (
  paths: NonNullable<ImportOptions['paths']>,
  patterns: NonNullable<ImportOptions['patterns']> = [],
): ImportRule => ['error', { paths, patterns }];

const onlyHexFetches =
  'Only src/hex talks to hex: add the request to src/hex/api.ts and call it through `hex`.';
const componentsNeverCallHex =
  'Components never call hex: read through a hook in src/hooks and write through its actions, like answerAsk or raiseTask.';
const hostMessage =
  "Import Host from '@/ui/host': its SwiftUI keeps clear of the keyboard only where it holds a field, so the keyboard can't push a view it covers up and half off its top.";

const fetch = { message: onlyHexFetches, name: 'expo/fetch' };
const hex = { message: componentsNeverCallHex, name: '@/hex' };
const hexInside = { group: ['@/hex/*'], message: componentsNeverCallHex };
const windowSize = {
  importNames: ['useWindowDimensions', 'Dimensions'],
  message:
    "The screen has one size: read it with useViewport(), the size it's laid out at. The window's size can disagree with it for a moment, as while iPhone Duo unfolds.",
  name: 'react-native',
};
const host = [
  { importNames: ['Host'], message: hostMessage, name: '@expo/ui' },
  { importNames: ['Host'], message: hostMessage, name: '@expo/ui/swift-ui' },
];
const scroll = {
  importNames: ['ScrollView'],
  message:
    "Import ScrollView from '@/ui/scroll': a drag down it pulls the keyboard away, as every scrolling view in the app does.",
  name: 'react-native',
};

const pending = {
  'anti-slop/no-array-filter-map': 'off',
  'anti-slop/no-chained-type-assertions': 'off',
  'anti-slop/no-conditional-empty-object-spread': 'off',
  'anti-slop/no-known-value-widening': 'off',
  'anti-slop/no-object-parameters': 'off',
  'anti-slop/no-runtime-typeof': 'off',
  'anti-slop/no-shape-in-symbol-names': 'off',
  'anti-slop/no-unknown-parameters': 'off',
  'anti-slop/no-unknown-returns': 'off',
  'anti-slop/no-unsafe-dictionary-type': 'off',
  'anti-slop/require-readable-spacing': 'off',
  'anti-slop/require-safety-comment-for-type-assertion': 'off',
  'class-methods-use-this': 'off',
  complexity: 'off',
  'default-case': 'off',
  'import/no-named-as-default-member': 'off',
  'jsx-a11y/aria-role': 'off',
  'jsx-a11y/label-has-associated-control': 'off',
  'max-classes-per-file': 'off',
  'no-await-in-loop': 'off',
  'no-bitwise': 'off',
  'no-comments/no-comments': 'off',
  'no-empty': 'off',
  'no-empty-function': 'off',
  'no-negated-condition': 'off',
  'no-nested-ternary': 'off',
  'no-param-reassign': 'off',
  'no-plusplus': 'off',
  'no-promise-executor-return': 'off',
  'no-redeclare': 'off',
  'no-shadow': 'off',
  'no-unexpected-multiline': 'off',
  'no-unused-vars': 'off',
  'no-use-before-define': 'off',
  'node/global-require': 'off',
  'prefer-destructuring': 'off',
  'prefer-named-capture-group': 'off',
  'preserve-caught-error': 'off',
  'promise/always-return': 'off',
  'promise/avoid-new': 'off',
  'promise/catch-or-return': 'off',
  'promise/no-nesting': 'off',
  'promise/param-names': 'off',
  'promise/prefer-await-to-callbacks': 'off',
  'promise/prefer-catch': 'off',
  'promise/valid-params': 'off',
  'react-hooks/exhaustive-deps': 'off',
  'react/capitalized-calls': 'off',
  'react/exhaustive-effect-dependencies': 'off',
  'react/hook-use-state': 'off',
  'react/jsx-handler-names': 'off',
  'react/jsx-no-constructed-context-values': 'off',
  'react/no-object-type-as-default-prop': 'off',
  'react/no-react-children': 'off',
  'react/set-state-in-effect': 'off',
  'react/style-prop-object': 'off',
  'react/todo': 'off',
  'require-await': 'off',
  'require-unicode-regexp': 'off',
  'sort-keys': 'off',
  'typescript/await-thenable': 'off',
  'typescript/consistent-return': 'off',
  'typescript/no-base-to-string': 'off',
  'typescript/no-deprecated': 'off',
  'typescript/no-explicit-any': 'off',
  'typescript/no-invalid-void-type': 'off',
  'typescript/no-non-null-assertion': 'off',
  'typescript/no-redundant-type-constituents': 'off',
  'typescript/no-unnecessary-type-assertion': 'off',
  'typescript/no-unsafe-argument': 'off',
  'typescript/no-unsafe-assignment': 'off',
  'typescript/no-unsafe-call': 'off',
  'typescript/no-unsafe-member-access': 'off',
  'typescript/no-unsafe-return': 'off',
  'typescript/no-unsafe-type-assertion': 'off',
  'typescript/parameter-properties': 'off',
  'typescript/prefer-nullish-coalescing': 'off',
  'typescript/prefer-readonly': 'off',
  'typescript/prefer-regexp-exec': 'off',
  'typescript/restrict-template-expressions': 'off',
  'typescript/return-await': 'off',
  'typescript/strict-boolean-expressions': 'off',
  'typescript/strict-void-return': 'off',
  'typescript/use-unknown-in-catch-callback-variable': 'off',
  'unicorn/consistent-existence-index-check': 'off',
  'unicorn/consistent-function-scoping': 'off',
  'unicorn/custom-error-definition': 'off',
  'unicorn/import-style': 'off',
  'unicorn/new-for-builtins': 'off',
  'unicorn/no-anonymous-default-export': 'off',
  'unicorn/no-array-for-each': 'off',
  'unicorn/no-array-reduce': 'off',
  'unicorn/no-array-reverse': 'off',
  'unicorn/no-array-sort': 'off',
  'unicorn/no-await-expression-member': 'off',
  'unicorn/no-negated-condition': 'off',
  'unicorn/no-useless-spread': 'off',
  'unicorn/no-useless-undefined': 'off',
  'unicorn/prefer-add-event-listener': 'off',
  'unicorn/prefer-code-point': 'off',
  'unicorn/prefer-export-from': 'off',
  'unicorn/prefer-math-trunc': 'off',
  'unicorn/prefer-module': 'off',
  'unicorn/prefer-number-properties': 'off',
  'unicorn/prefer-query-selector': 'off',
  'unicorn/prefer-set-has': 'off',
  'unicorn/prefer-string-replace-all': 'off',
  'unicorn/prefer-ternary': 'off',
} as const;

export default defineConfig({
  extends: [core, react, reactNative, antiSlop],
  ignorePatterns: [...(core.ignorePatterns ?? []), '.claude/**', 'ios/**', 'dist/**'],
  jsPlugins: [{ name: 'no-comments', specifier: './tools/oxlint/no-comments.ts' }],
  options: { reportUnusedDisableDirectives: 'error', typeAware: true },
  overrides: [
    {
      files: ['src/**'],
      rules: {
        'no-restricted-globals': ['error', { message: onlyHexFetches, name: 'fetch' }],
        'no-restricted-imports': restricted([fetch, windowSize, ...host, scroll]),
      },
    },
    {
      files: ['src/hex/**'],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-imports': restricted([windowSize, ...host, scroll]),
      },
    },
    {
      files: ['src/app/**', 'src/call/**', 'src/components/**', 'src/screens/**'],
      rules: {
        'no-restricted-imports': restricted([fetch, hex, windowSize, ...host, scroll], [hexInside]),
      },
    },
    {
      files: ['src/call/use-call.tsx'],
      rules: { 'no-restricted-imports': restricted([fetch, windowSize, ...host, scroll]) },
    },
    {
      files: ['src/call/pose-report.tsx'],
      rules: { 'no-restricted-imports': restricted([fetch, hex, ...host, scroll], [hexInside]) },
    },
    {
      files: ['src/ui/host.tsx'],
      rules: { 'no-restricted-imports': restricted([fetch, windowSize, scroll]) },
    },
    { files: ['src/ui/scroll.tsx'], rules: { 'no-restricted-imports': 'off' } },
  ],
  rules: {
    'import/no-cycle': 'error',
    'oxc/no-accumulating-spread': 'error',
    'typescript/no-floating-promises': [
      'error',
      {
        allowForKnownSafeCalls: [
          { from: 'package', name: ['describe', 'it', 'suite', 'test'], package: 'node:test' },
        ],
      },
    ],
    ...pending,
  },
});
