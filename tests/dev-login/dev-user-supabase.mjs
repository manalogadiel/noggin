import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Keep the real CLI entry point and replace its Supabase transport in the child process.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@supabase/supabase-js") {
      return { url: import.meta.url, format: "module", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

globalThis.fetch = async () => {
  throw new Error("Network access is disabled in the dev-user test");
};

const stateFile = "supabase-fixture.json";

export function createClient(url, key) {
  if (url !== process.env.NEXT_PUBLIC_SUPABASE_URL || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Expected the configured fixture Supabase URL and service key");
  }

  const state = existsSync(stateFile)
    ? JSON.parse(readFileSync(stateFile, "utf8"))
    : { users: [], profiles: {} };
  const persist = () => writeFileSync(stateFile, JSON.stringify(state));
  persist();

  return {
    auth: {
      admin: {
        async listUsers() {
          return { data: { users: state.users, nextPage: null, lastPage: 1 }, error: null };
        },
        async createUser(attributes) {
          if (state.users.some((user) => user.email === attributes.email)) {
            return { data: { user: null }, error: { code: "email_exists", message: "User already registered" } };
          }
          const user = { ...attributes, id: "fixture-user" };
          state.users.push(user);
          // Mirror the signup trigger's profile for an adult account.
          state.profiles[user.id] = {
            id: user.id,
            birth_date: attributes.user_metadata?.birth_date,
            guardian_consent_status: "not_required",
          };
          persist();
          return { data: { user }, error: null };
        },
        async updateUserById(id, attributes) {
          const user = state.users.find((entry) => entry.id === id);
          if (!user) throw new Error("Cannot update an unknown fixture user");
          Object.assign(user, attributes);
          persist();
          return { data: { user }, error: null };
        },
      },
    },
    from(table) {
      if (table !== "profiles") throw new Error("Expected a profile update");
      return {
        update(fields) {
          return {
            async eq(column, id) {
              if (column !== "id" || !state.profiles[id]) {
                throw new Error("Expected the fixture user's profile");
              }
              Object.assign(state.profiles[id], fields);
              persist();
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };
}
