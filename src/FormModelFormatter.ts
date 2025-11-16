import { Array, Effect, Either, ParseResult } from "effect"

/**
 * Form Model Formatter Issue Value
 */

export interface FormModelFormatterIssueValue {
  /**
   * The actual value that caused the issue
   */
  readonly actual: string | undefined

  /**
   * A descriptive message explaining the issue
   */
  readonly message: string | undefined
}

/**
 * Form Model Formatter Result
 *
 * A record where keys are paths (joined with ".") and values contain actual and message
 */
export type FormModelFormatterResult = Record<string, FormModelFormatterIssueValue | undefined>

/**
 * Form Model Formatter
 *
 * A custom formatter that builds a record with key (path as string) mapping to
 * objects with actual value and message.
 * Leverages the existing ArrayFormatter for message formatting and adds actual values.
 */
export const FormModelFormatter: ParseResult.ParseResultFormatter<FormModelFormatterResult> = {
  formatIssue: (issue) => {
    // Build a map of path -> actual value by traversing the issue tree
    const actualEntries = collectActualValues(issue, [])
    const actualMap = new Map(actualEntries)

    // Use ArrayFormatter to get formatted messages, then enhance with actual values
    return ParseResult.map(
      ParseResult.ArrayFormatter.formatIssue(issue),
      (arrayIssues) =>
        Array.reduce(
          arrayIssues,
          {} as FormModelFormatterResult,
          (result, arrayIssue) => {
            const key = arrayIssue.path.join(".")
            const actual = actualMap.get(key) as string | undefined
            result[key] = {
              actual,
              message: arrayIssue.message
            }
            return result
          }
        )
    )
  },
  formatIssueSync: (issue) => {
    const e = FormModelFormatter.formatIssue(issue)
    const isEither = <A, E, R>(self: Effect.Effect<A, E, R>): self is Either.Either<A, E> =>
      Either.isEither(self as any)
    return isEither(e) ? Either.getOrThrow(e) : Effect.runSync(e)
  },
  formatError: (error) => FormModelFormatter.formatIssue(error.issue),
  formatErrorSync: (error) => FormModelFormatter.formatIssueSync(error.issue)
}
/**
 * Recursively collect actual values from the issue tree
 * Returns an array of [path, actual] tuples
 */
const collectActualValues = (
  issue: ParseResult.ParseIssue,
  path: ReadonlyArray<PropertyKey>
): ReadonlyArray<readonly [string, unknown]> => {
  const actual = "actual" in issue ? issue.actual : undefined
  const key = path.join(".")

  switch (issue._tag) {
    case "Pointer": {
      // Handle Path type which is SingleOrNonEmpty<PropertyKey>
      const pathItems: ReadonlyArray<PropertyKey> = (
        Array.isArray(issue.path) ? issue.path : [issue.path]
      ) as ReadonlyArray<PropertyKey>
      const newPath = Array.appendAll(path, pathItems)
      const newKey = newPath.join(".")
      return Array.appendAll(
        [[newKey, issue.actual] as const],
        collectActualValues(issue.issue, newPath)
      )
    }
    case "Composite": {
      const currentEntry: readonly [string, unknown] = [key, actual]
      // Handle SingleOrNonEmpty<ParseIssue>
      const issueList: ReadonlyArray<ParseResult.ParseIssue> = (
        Array.isArray(issue.issues) ? issue.issues : [issue.issues]
      ) as ReadonlyArray<ParseResult.ParseIssue>
      const childEntries = Array.flatMap(
        issueList,
        (childIssue) => collectActualValues(childIssue, path)
      )
      return Array.prepend(childEntries, currentEntry)
    }
    case "Refinement":
      return Array.appendAll(
        [[key, actual] as const],
        collectActualValues(issue.issue, path)
      )
    case "Transformation":
      return Array.appendAll(
        [[key, actual] as const],
        collectActualValues(issue.issue, path)
      )
    default:
      // Leaf nodes: Type, Missing, Unexpected, Forbidden
      return [[key, actual] as const]
  }
}
