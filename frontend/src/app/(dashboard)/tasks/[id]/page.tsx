import { redirect } from 'next/navigation'

/** Legacy notification links pointed here; send people to the task board. */
export default async function TaskDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (id) redirect(`/updates?task=${id}`)
  redirect('/tasks')
}
