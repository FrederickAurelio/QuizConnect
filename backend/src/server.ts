import { server, PORT } from "./app.js";

const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
server.listen(PORT, host, () => {
  console.log(`Server running on http://${host}:${PORT}`);
});
