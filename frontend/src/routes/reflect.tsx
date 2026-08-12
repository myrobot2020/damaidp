import { createFileRoute, Outlet } from "@tanstack/react-router";

// Parent layout for `/reflect/*`.
// Child routes `reflect.index`, `reflect.thinking`, and `reflect.answer` render via `<Outlet />`.
export const Route = createFileRoute("/reflect")({
  component: ReflectLayout,
});

function ReflectLayout() {
  return <Outlet />;
}

