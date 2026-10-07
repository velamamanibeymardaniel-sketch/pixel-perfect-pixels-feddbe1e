import { createFileRoute } from "@tanstack/react-router";
import { RequestsListPage } from "@/components/requests-list-page";

export const Route = createFileRoute("/_app/solicitudes/")({ component: () => <RequestsListPage mine={false} /> });
