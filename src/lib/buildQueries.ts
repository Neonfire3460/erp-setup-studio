import { queryOptions } from "@tanstack/react-query";
import { getBuildOptions, getHistory } from "./build.functions";
export const buildOptions = queryOptions({ queryKey: ["build-options"], queryFn: () => getBuildOptions() });
export const historyOptions = queryOptions({ queryKey: ["history"], queryFn: () => getHistory() });