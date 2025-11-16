import { describe, expect, it } from "@effect/vitest"
import type { ParseResult } from "effect"
import { Effect, Schema } from "effect"
import * as FormData from "../src/FormData.js"

describe("schemaFromSelf", () => {
  const formData = new globalThis.FormData()
  formData.append("name", "John")

  it.effect("can decode self", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decode(FormData.schemaFromSelf)(formData)
      expect(decoded).toBe(formData)
    }))

  it.effect("can encode self", () =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encode(FormData.schemaFromSelf)(formData)
      expect(encoded).toBe(formData)
    }))
})

describe("schemaRecord", () => {
  it.effect("can decode strings", () =>
    Effect.gen(function*() {
      const formData = FormData.fromFormDataRecord({ name: "John" })
      const schema = FormData.schemaRecord(
        Schema.Struct({
          name: Schema.String
        })
      )
      const decoded = yield* Schema.decode(schema)(formData)
      expect(decoded.name).toBe("John")
    }))

  it.effect("can decode numbers", () =>
    Effect.gen(function*() {
      const formData = FormData.fromFormDataRecord({ age: "20" })
      const schema = FormData.schemaRecord(
        Schema.Struct({
          age: Schema.NumberFromString
        })
      )
      const decoded = yield* Schema.decode(schema)(formData)
      expect(decoded.age).toBe(20)
    }))

  it.effect("decodes arrays", () =>
    Effect.gen(function*() {
      const formData = FormData.fromFormDataRecord({ pets: ["Fido", "Rex"] })
      const schema = FormData.schemaRecord(
        Schema.Struct({
          pets: Schema.Array(Schema.String)
        })
      )
      const decoded = yield* Schema.decode(schema)(formData)
      expect(decoded.pets).toStrictEqual(["Fido", "Rex"])
    }))

  it("cannot decode non-form-coercible values", () => {
    // @ts-expect-error - Numbers are not form coercible
    FormData.schemaRecord(Schema.Struct({ foo: Schema.Number }))

    // @ts-expect-error - Objects are not form coercible
    FormData.schemaRecord(Schema.Struct({ foo: Schema.Struct({}) }))

    // @ts-expect-error - Booleans are not form coercible
    FormData.schemaRecord(Schema.Struct({ foo: Schema.Boolean }))
    expect(true).toBe(true)
  })
})

describe("toRecord", () => {
  it("maps strings", () => {
    const formData = new globalThis.FormData()
    formData.append("name", "John")
    const record = FormData.toRecord(formData)
    expect(record.name).toBe("John")
  })

  it("maps arrays", () => {
    const formData = new globalThis.FormData()
    formData.append("pets", "Fido")
    formData.append("pets", "Rex")
    const record = FormData.toRecord(formData)
    expect(record.pets).toStrictEqual(["Fido", "Rex"])
  })

  it("maps files", () => {
    const file = new globalThis.File([], "file.txt")
    const formData = new globalThis.FormData()
    formData.append("file", file)
    const record = FormData.toRecord(formData)
    expect(record.file).toBe(file)
  })
})

describe("fromFormDataRecord", () => {
  it("maps strings", () => {
    const formData = FormData.fromFormDataRecord({ name: "John" })
    expect(formData.get("name")).toBe("John")
  })

  it("maps arrays", () => {
    const formData = FormData.fromFormDataRecord({ pets: ["Fido", "Rex"] })
    expect(formData.getAll("pets")).toStrictEqual(["Fido", "Rex"])
  })

  it("maps files", () => {
    const file = new globalThis.File([], "file.txt")
    const formData = FormData.fromFormDataRecord({ file })
    expect(formData.get("file")).toBe(file)
  })
})

describe("FormFieldModelSchema", () => {
  it("cannot define with non-form-coercible values", () => {
    // @ts-expect-error - Numbers are not form coercible
    FormData.FormFieldModelSchema(Schema.Number)

    // @ts-expect-error - Objects are not form coercible
    FormData.FormFieldModelSchema(Schema.Struct({}))

    // @ts-expect-error - Booleans are not form coercible
    FormData.FormFieldModelSchema(Schema.Boolean)

    // @ts-expect-error - Number arrays are not form coercible
    FormData.FormFieldModelSchema(Schema.Array(Schema.Number))

    // @ts-expect-error - Object arrays are not form coercible
    FormData.FormFieldModelSchema(Schema.Array(Schema.Struct({})))

    // @ts-expect-error - Boolean arrays are not form coercible
    FormData.FormFieldModelSchema(Schema.Array(Schema.Boolean))
  })

  it("defines with form-coercible values", () => {
    const schema = FormData.FormFieldModelSchema(Schema.String)
    expect(schema).toBeDefined()
  })
})

describe("FormModelSchema", () => {
  it("cannot define with non-FormModelSchema fields", () => {
    // @ts-expect-error - Numbers are not form coercible
    FormData.FormModelSchema({ age: Schema.Number })
  })
})

describe("decodeFormModelSchema", () => {
  const AgeField = FormData.FormFieldModelSchema(
    Schema.NumberFromString.pipe(Schema.greaterThanOrEqualTo(18)).annotations({
      message: (issue: ParseResult.ParseIssue) => `Must be 18 or over! Got: ${issue.actual}`
    })
  )

  const Form = FormData.FormModelSchema({ age: AgeField })

  it.effect("succeeds when valid", () =>
    Effect.gen(function*() {
      const formData = new globalThis.FormData()
      formData.append("age", "18")
      const model = yield* FormData.decodeFormModel(Form)(formData)
      expect(model).toStrictEqual({
        age: 18
      })
    }))

  it.effect("fails with error model", () =>
    Effect.gen(function*() {
      const formData = new globalThis.FormData()
      formData.append("age", "17")
      const error = yield* FormData.decodeFormModel(Form)(formData).pipe(Effect.flip)
      expect(error).toStrictEqual({
        age: {
          actual: 17,
          message: "Must be 18 or over! Got: 17"
        }
      })
    }))
})
