import { ClassType, ObjectType, Field, Int } from 'type-graphql'

export default function PaginatedResponse<TItem>(TItemClass: ClassType<TItem>) {
  // Provide a unique type name used in schema
  @ObjectType(`Paginated${TItemClass.name}Response`)
  class PaginatedResponseClass {
    // here we use the runtime argument
    @Field(() => [TItemClass])
    // and here the generic type
    items: TItem[]

    @Field()
    currentPage: number

    @Field()
    totalPages: number
  }
  return PaginatedResponseClass
}

export { PaginatedResponse }
