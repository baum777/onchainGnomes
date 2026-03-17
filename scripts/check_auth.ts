import "dotenv/config";
import { invokeXApiRequest } from "../src/clients/xApi.js";

async function checkAuth() {
  try {
    const user = await invokeXApiRequest<{ data: { id: string; username?: string; name?: string } }>({
      method: "GET",
      uri: "https://api.x.com/2/users/me",
    });

    console.log("Authenticated as:");
    console.log("ID:", user.data.id);
    console.log("Username:", user.data.username);
    console.log("Name:", user.data.name);
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

checkAuth();
