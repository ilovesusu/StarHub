interface Env {
  CLIENT_ID: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context
  return Response.json({
    CLIENT_ID: env.CLIENT_ID || ''
  })
}
