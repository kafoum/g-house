module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off', // Autorise console.log pour le backend
    'node/no-unpublished-require': 'off',
    'node/no-missing-require': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_|next' }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
};
