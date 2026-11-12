import { Navigate, Route } from "react-router";
import type { AppModule, ModuleRoute } from "@/app/module";
import { ModuleBoundary } from "@/app/ModuleBoundary";

function renderRoute(moduleId: string, route: ModuleRoute, key: string) {
  const Component = route.component;
  const element = route.redirectTo ? (
    <Navigate to={route.redirectTo} replace />
  ) : Component ? (
    <ModuleBoundary moduleId={moduleId}>
      <Component />
    </ModuleBoundary>
  ) : undefined;

  if (route.index) {
    return <Route key={key} index element={element} />;
  }

  return (
    <Route key={key} path={route.path} element={element}>
      {route.children?.map((child, i) => renderRoute(moduleId, child, `${key}.${i}`))}
    </Route>
  );
}

/** Convierte las rutas de los módulos registrados en <Route>, cada una dentro de su ModuleBoundary. */
export function renderModuleRoutes(modules: AppModule[]) {
  return modules.flatMap((module) =>
    module.routes.map((route, i) => renderRoute(module.id, route, `${module.id}.${i}`)),
  );
}
