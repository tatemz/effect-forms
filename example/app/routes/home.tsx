import { decodeFormModel, FormFieldModelSchema, FormModelSchema } from "@tatemz/effect-forms/FormData"
import cn from "classnames"
import { Effect, Schema } from "effect"
import { Form } from "react-router"
import type { Route } from "./+types/home"

const NameField = FormFieldModelSchema(Schema.NonEmptyString.pipe(
  Schema.minLength(10),
  Schema.annotations({
    message: () => "Name must be at least 10 characters long"
  })
))

const MyForm = FormModelSchema({
  name: NameField
})

type PageModel = {
  _tag: "Form"
  form: {
    name: {
      id: string
      label: string
      name: string
      placeholder: string
      defaultValue?: string
      error?: string
    }
  }
} | {
  _tag: "Success"
  formData: {
    name: string
  }
}

export const action = async (args: Route.ActionArgs): Promise<PageModel> => {
  const formData = await args.request.formData()

  const model = await decodeFormModel(MyForm)(formData).pipe(
    Effect.map((data) => ({
      _tag: "Success",
      formData: {
        name: data.name
      }
    } as PageModel)),
    Effect.catchAll((error) =>
      Effect.succeed({
        _tag: "Form",
        form: {
          name: {
            id: "my-name-field",
            label: "Enter your name",
            name: "name",
            placeholder: "John Doe",
            defaultValue: error.name?.actual,
            error: error.name?.message
          }
        }
      } as PageModel)
    ),
    Effect.runPromise
  )

  return model
}

export const loader = async (_: Route.LoaderArgs): Promise<PageModel> => {
  return {
    _tag: "Form",
    form: {
      name: {
        id: "my-name-field",
        label: "Enter your name",
        name: "name",
        placeholder: "John Doe",
        defaultValue: undefined,
        error: undefined
      }
    }
  }
}

export default function Home(props: Route.ComponentProps) {
  const model = props.actionData || props.loaderData
  if (model._tag === "Success") {
    return (
      <div className="container mx-auto">
        <div className="hero bg-base-200 min-h-screen">
          <div className="hero-content text-center">
            <h1 className="text-5xl font-bold">Hello there</h1>
          </div>
        </div>
      </div>
    )
  }

  const form = model.form

  return (
    <div className="container mx-auto">
      <div className="hero bg-base-200 min-h-screen">
        <div className="hero-content text-center">
          <Form className="max-w-md flex flex-col" method="post">
            <h1 className="text-5xl font-bold">Hello there</h1>
            <div>
              <fieldset className="fieldset">
                <legend className="fieldset-legend">{form.name.label}</legend>
                <input
                  type="text"
                  className={cn({
                    "input": true,
                    "validator": true,
                    "input-error": form.name.error
                  })}
                  required
                  id={form.name.id}
                  name={form.name.name}
                  placeholder={form.name.placeholder}
                  defaultValue={form.name.defaultValue}
                />
                <div className="text-error">{form.name.error}</div>
              </fieldset>
            </div>
            <button className="btn btn-primary" type="submit">Submit</button>
          </Form>
        </div>
      </div>
    </div>
  )
}
