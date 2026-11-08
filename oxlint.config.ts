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
    {
      files: ['plugins/**', 'fingerprint.config.js', 'metro.config.js'],
      rules: { 'unicorn/prefer-module': 'off' },
    },
    { files: ['src/call/call-screen.tsx'], rules: { complexity: 'off' } },
    {
      files: ['src/components/tasks/tasks-view.tsx'],
      rules: { 'react/jsx-no-constructed-context-values': 'off' },
    },
    { files: ['tests/fixtures/capture.mts'], rules: { 'anti-slop/no-runtime-typeof': 'off' } },
    {
      files: ['**/*.js', '**/*.mjs'],
      rules: {
        'typescript/no-unsafe-argument': 'off',
        'typescript/no-unsafe-assignment': 'off',
        'typescript/no-unsafe-call': 'off',
        'typescript/no-unsafe-member-access': 'off',
        'typescript/no-unsafe-return': 'off',
        'typescript/strict-boolean-expressions': 'off',
      },
    },
  ],
  rules: {
    'anti-slop/no-shape-in-symbol-names': 'off',
    'default-case': 'off',
    'import/no-cycle': 'error',
    'jsx-a11y/aria-role': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
    'no-comments/no-comments': 'error',
    'no-empty-function': ['error', { allow: ['arrowFunctions'] }],
    'no-redeclare': 'off',
    'no-use-before-define': ['error', { functions: false, variables: false }],
    'oxc/no-accumulating-spread': 'error',
    'prefer-destructuring': ['error', { array: false, object: true }],
    'promise/valid-params': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react/capitalized-calls': 'off',
    'react/exhaustive-effect-dependencies': 'off',
    'react/hook-use-state': 'off',
    'react/jsx-handler-names': 'off',
    'react/set-state-in-effect': 'off',
    'require-await': 'off',
    'sort-keys': 'off',
    'typescript/consistent-return': 'off',
    'typescript/no-floating-promises': [
      'error',
      {
        allowForKnownSafeCalls: [
          { from: 'package', name: ['describe', 'it', 'suite', 'test'], package: 'node:test' },
        ],
      },
    ],
  },
});
