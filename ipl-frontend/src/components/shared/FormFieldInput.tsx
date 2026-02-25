/* eslint-disable @typescript-eslint/no-explicit-any */
import { Input } from "@/components/ui/input"
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"

export function FormFieldInput({
  control,
  name,
  label,
  type = "text",
}: any) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }: any) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}