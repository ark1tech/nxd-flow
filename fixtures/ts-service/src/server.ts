import Fastify from "fastify";

const users = new Map<string, { id: string; name: string; password: string }>([
  ["demo@example.com", { id: "fixture-user", name: "Fixture User", password: "password" }]
]);

export function buildServer() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: { email: string; password: string } }>("/auth/login", async (request, reply) => {
    const user = users.get(request.body.email);
    if (!user || user.password !== request.body.password) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    return {
      token: Buffer.from(JSON.stringify({ sub: user.id, email: request.body.email })).toString("base64url")
    };
  });

  app.get("/profile", async (request, reply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "missing_token" });
    }
    return {
      id: "fixture-user",
      name: "Fixture User"
    };
  });

  return app;
}

if (process.argv[1]?.endsWith("server.ts")) {
  const app = buildServer();
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
  console.log("fixture-ts-service listening");
}
