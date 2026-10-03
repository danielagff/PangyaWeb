import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.tsbuild/**', 'assets/**', 'docs/referencias/powerbar/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
)
