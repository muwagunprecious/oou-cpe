export function roleHome(role?: string | null): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "lecturer") return "/lecturer/dashboard";
  return "/student/dashboard";
}
