import type { AppModule } from "@/app/module";
import { onboardingModule } from "@/modules/onboarding";
import { superAdminAuthModule } from "@/modules/super-admin-auth";
import { workspaceModule } from "@/modules/workspace";

/** Módulos registrados. Para agregar uno: importarlo aquí y sumarlo a la lista. */
export const modules: AppModule[] = [superAdminAuthModule, onboardingModule, workspaceModule];
