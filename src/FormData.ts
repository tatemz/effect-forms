import { Array, Data, Effect, Record, Schema } from "effect"
import type { Paths as DotDelimtedPaths } from "type-fest"
import { FormModelFormatter } from "./FormModelFormatter.js"

/**
 * Form Data Coercible Value
 *
 * A value that can be coerced to a FormData entry value.
 */
export type FormDataCoercibleValue =
  | globalThis.FormDataEntryValue
  | ReadonlyArray<globalThis.FormDataEntryValue>

/**
 * Form Data Record
 *
 * A record of FormData entry values.
 */
export type FormDataRecord = Record<string, FormDataCoercibleValue>

/**
 * Schema From Self
 *
 * A schema for FormData.
 */
export const schemaFromSelf: Schema.Schema<globalThis.FormData> = Schema.declare(
  (u): u is globalThis.FormData => u instanceof globalThis.FormData,
  { identifier: "FormData" }
)

/**
 * Schema Record
 *
 * Builds a FormData schema from a given schema.
 */
export const schemaRecord = <A, I extends FormDataRecord, R>(
  schema: Schema.Schema<A, I, R>
): Schema.Schema<A, FormData, R> =>
  Schema.transform(schemaFromSelf, schema, {
    decode: (fromA, _fromI) => toRecord(fromA) as I,
    encode: (toI, _toA) => fromFormDataRecord(toI),
    strict: true
  })

/**
 * To Record
 *
 * Converts a FormData to a record.
 */
export const toRecord = (formData: FormData): FormDataRecord => {
  const grouped = Array.groupBy(
    Array.fromIterable(formData.entries()),
    ([key]) => key
  )
  return Record.fromIterableWith(Object.entries(grouped), ([key, entries]) => {
    const values = entries.map(([, value]) => value)
    return [key, values.length === 1 ? values[0] : [...values]]
  })
}

/**
 * From Data Input
 *
 * Converts a record to FormData.
 */
export const fromFormDataRecord = (input: FormDataRecord) =>
  Record.reduce(input, new FormData(), (acc, value, key) => {
    if (Array.isArray(value)) {
      Array.forEach(value, (item) => {
        if (item == null) return
        acc.append(key, item instanceof globalThis.File ? item : String(item))
      })
    } else if (value != null) {
      acc.append(key, value instanceof globalThis.File ? value : String(value))
    }
    return acc
  })

/**
 * Form Field Model Schema Type Id
 */
export const FormFieldModelSchemaTypeId: unique symbol = Symbol("FormFieldModelSchemaTypeId")
export type FormFieldModelSchemaTypeId = typeof FormFieldModelSchemaTypeId

/**
 * Form Field Model Schema
 *
 * Builds a form field model from a given schema.
 *
 * @todo Add missing message support.
 */
export type FormFieldModelSchema<A, I extends FormDataCoercibleValue, R> = {
  [FormFieldModelSchemaTypeId]: FormFieldModelSchemaTypeId
  schema: Schema.Schema<A, I, R>
}
export const FormFieldModelSchema = <A, I extends FormDataCoercibleValue, R>(
  schema: Schema.Schema<A, I, R>
): FormFieldModelSchema<A, I, R> => ({
  [FormFieldModelSchemaTypeId]: FormFieldModelSchemaTypeId,
  schema
})

/**
 * Form Model Schema Type Id
 */
export const FormModelSchemaTypeId: unique symbol = Symbol("FormModelSchemaTypeId")
export type FormModelSchemaTypeId = typeof FormModelSchemaTypeId

/**
 * Form Model Schema Fields
 */
type FormModelSchemaFields = { readonly [x: PropertyKey]: FormFieldModelSchema<any, any, any> }

/**
 * Form Model Schema
 *
 * Builds a form model from a given schema.
 */
export type FormModelSchema<Fields extends FormModelSchemaFields> = {
  [FormFieldModelSchemaTypeId]: FormFieldModelSchemaTypeId
  fields: Fields
}
export const FormModelSchema = <
  Fields extends FormModelSchemaFields
>(
  fields: Fields
): FormModelSchema<Fields> => ({
  [FormFieldModelSchemaTypeId]: FormFieldModelSchemaTypeId,
  fields
})

/**
 * Form Model Parse Error
 */
export class FormModelParseError<A> extends Data.TaggedError("FormModelParseError")<
  {
    errorMessages: { [K in DotDelimtedPaths<A>]?: string }
  }
> {}

/**
 * Decode Form Model
 *
 * Decodes a form model from a given form model schema.
 */
export const decodeFormModel = <Fields extends FormModelSchemaFields>(
  formModelSchema: FormModelSchema<Fields>
) =>
(formData: FormData) =>
  Effect.gen(function*() {
    type StructFields = { [K in keyof Fields]: Fields[K]["schema"] }
    const fields = Record.map(formModelSchema.fields, (f) => f.schema) as StructFields
    const fieldsSchema = Schema.Struct<StructFields>(fields)
    const formDataSchema = schemaRecord<
      Schema.Struct.Type<StructFields>,
      Schema.Struct.Encoded<StructFields>,
      never
    >(fieldsSchema as any)
    const decoded = yield* Schema.decode(formDataSchema)(formData).pipe(
      Effect.catchAll((error) => FormModelFormatter.formatError(error).pipe(Effect.flip))
    )
    return decoded
  })
