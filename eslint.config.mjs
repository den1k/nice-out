import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  { ignores: ['public/sw*.js', '.next/**'] },
  {
    // New in eslint-config-next 16 and flagged on existing, working code. Kept
    // visible as warnings rather than rewriting components in a version bump.
    rules: {
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
]

export default config
