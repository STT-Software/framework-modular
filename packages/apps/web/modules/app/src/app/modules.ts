import type { AppModule } from "@/app/module";
import { businessAccessModule } from "@/modules/business-access";
import { businessDashboardModule } from "@/modules/business-dashboard";
import { businessSetupModule } from "@/modules/business-setup";
import { onboardingModule } from "@/modules/onboarding";
import { ordersConfigModule } from "@/modules/orders-config/public";
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
  businessDashboardModule,
  turnosModule,
  ordersConfigModule,
];
