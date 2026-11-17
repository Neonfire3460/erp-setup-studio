import { queryOptions } from "@tanstack/react-query";
import {
  buildOptions,
  mySubmissions,
  adminWorkflow,
  reviewDetail,
  workflowBadges,
  ticketSamples,
} from "./submissions.functions";
export const buildOptionsQuery = queryOptions({
  queryKey: ["build-options"],
  queryFn: () => buildOptions(),
});
export const submissionsQuery = queryOptions({
  queryKey: ["submissions"],
  queryFn: () => mySubmissions(),
});
export const adminQuery = queryOptions({
  queryKey: ["admin-workflow"],
  queryFn: () => adminWorkflow(),
});
export const badgesQuery = queryOptions({
  queryKey: ["workflow-badges"],
  queryFn: () => workflowBadges(),
  refetchInterval: 30000,
});
export const detailQuery = (id: string) =>
  queryOptions({ queryKey: ["review-detail", id], queryFn: () => reviewDetail({ data: { id } }) });
export const samplesQuery = (id: string) =>
  queryOptions({
    queryKey: ["ticket-samples", id],
    queryFn: () => ticketSamples({ data: { id } }),
  });
