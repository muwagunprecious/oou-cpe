import { supabaseAdmin } from "./lib/supabase.js";

async function run() {
  const adminEmail = "admin@oouagoiwoye.edu.ng";
  const adminPassword = "AdminOOU2026!";
  const adminName = "Portal Administrator";

  console.log("Checking if admin user exists in Supabase...");

  // 1. Try to list users to see if admin already exists
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }

  let adminUser = users.find(u => u.email === adminEmail);

  if (adminUser) {
    console.log(`Admin user ${adminEmail} already exists. promoting role to 'admin' in public.users...`);
    
    // Set role = 'admin' and status = 'active'
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .upsert({
        id: adminUser.id,
        full_name: adminName,
        email: adminEmail,
        role: "admin",
        status: "active",
        department: "Computer Engineering"
      });

    if (updateError) {
      console.error("Error promoting user to admin:", updateError);
    } else {
      console.log(`Successfully ensured admin privileges for ${adminEmail}!`);
    }
  } else {
    console.log(`Creating new admin user: ${adminEmail}...`);
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminName,
        role: "admin"
      }
    });

    if (createError) {
      console.error("Error creating admin user:", createError);
      return;
    }

    if (user) {
      console.log(`User created successfully in auth.users. Updating public.users to ensure role...`);
      
      const { error: profileError } = await supabaseAdmin
        .from("users")
        .upsert({
          id: user.id,
          full_name: adminName,
          email: adminEmail,
          role: "admin",
          status: "active",
          department: "Computer Engineering"
        });

      if (profileError) {
        console.error("Error updating public profile:", profileError);
      } else {
        console.log("\n==============================================");
        console.log("ADMIN ACCOUNT SUCCESSFULLY CREATED!");
        console.log(`Email: ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
        console.log("==============================================\n");
      }
    }
  }
}

run();
