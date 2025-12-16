import { server, PORT } from "./app.js";

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
