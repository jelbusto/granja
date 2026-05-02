import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL = "admin@dairypro.com";
const PASSWORD = "Admin1234!";
const ADMIN_TIPO_ID = "00000000-0000-0000-0001-000000000001";

async function main() {
  // 1. Crear usuario en auth
  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nombre: "Administrador" },
  });

  if (error) {
    // Si ya existe, buscarlo
    if (error.message.includes("already")) {
      console.log("Usuario ya existe, actualizando perfil...");
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === EMAIL);
      if (existing) {
        await updateProfile(existing.id);
      }
      return;
    }
    console.error("Error al crear usuario:", error.message);
    process.exit(1);
  }

  console.log("✓ Usuario creado:", data.user?.id);
  await updateProfile(data.user!.id);
}

async function updateProfile(userId: string) {
  const { error } = await supabase
    .from("usuarios_perfil")
    .upsert({
      id: userId,
      nombre: "Administrador",
      apellidos: "",
      email: EMAIL,
      id_tipo_usuario: ADMIN_TIPO_ID,
    });

  if (error) {
    console.error("Error al actualizar perfil:", error.message);
  } else {
    console.log("✓ Perfil actualizado a Admin");
    console.log("\n──────────────────────────────");
    console.log("  Email:      ", EMAIL);
    console.log("  Contraseña: ", PASSWORD);
    console.log("──────────────────────────────\n");
  }
}

main();
