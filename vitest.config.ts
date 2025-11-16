import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [],
  test: {
    setupFiles: [path.join(__dirname, "setupTests.ts")],
    include: ["./test/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@tatemz/effect-forms/test": path.join(__dirname, "test"),
      "@tatemz/effect-forms": path.join(__dirname, "src")
    }
  }
})
