import { Navigate, useParams, useSearchParams } from "react-router";
import { salesSections } from "../sections";

export default function LegacyOperationRedirect() {
  const { businessId } = useParams();
  const [query] = useSearchParams();
  const target = salesSections.find(item => item.id === query.get("view"))?.id ?? "dashboard";
  return <Navigate to={`/business/app/${businessId}/pedidos/${target}`} replace />;
}
