import type { AppModule } from "@/app/module";
import { businessAccessModule } from "@/modules/business-access";
import { businessSetupModule } from "@/modules/business-setup";
import { onboardingModule } from "@/modules/onboarding";
import { ordersConfigModule } from "@/modules/orders-config";
import { superAdminAuthModule } from "@/modules/super-admin-auth";
import { turnosModule } from "@/modules/turnos";
import { workspaceModule } from "@/modules/workspace";

/** Módulos registrados. Para agregar uno: importarlo aquí y sumarlo a la lista. */
export const modules: AppModule[] = [
  superAdminAuthModule,
  onboardingModule,
  workspaceModule,
  businessAccessModule,
  businessSetupModule,
  turnosModule,
  ordersConfigModule,
];
