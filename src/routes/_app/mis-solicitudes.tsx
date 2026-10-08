import { createFileRoute } from "@tanstack/react-router";
import { RequestsListPage } from "@/components/requests-list-page";

export const Route = createFileRoute("/_app/mis-solicitudes")({
  component: () => <RequestsListPage mine />,
});
