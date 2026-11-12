import type { AppModule } from "@/app/module";
import { superAdminAuthModule } from "@/modules/super-admin-auth";

/** Módulos registrados. Para agregar uno: importarlo aquí y sumarlo a la lista. */
export const modules: AppModule[] = [superAdminAuthModule];
