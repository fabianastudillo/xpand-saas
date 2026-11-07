import { createOrPromoteAdmin } from "@/repositories/user-repository";

// Lower-cased: Auth.js normalises the magic-link e-mail, so an upper-case ADMIN_EMAIL would never match.
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

async function makeAdminUser() {
  if (!adminEmail) {
    throw new Error(
      "Please provide an admin email. You can do this in the make-admin-user-script.ts file.",
    );
  }

  const userAdmin = await createOrPromoteAdmin({ email: adminEmail, name: "admin" });

  console.log({ userAdmin });
}

makeAdminUser();
