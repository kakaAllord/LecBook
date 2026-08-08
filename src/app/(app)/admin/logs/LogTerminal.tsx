"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Terminal, RefreshCw, Play, Pause, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AuditLogEntry, Paginated, UserRole } from "@/types";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { toneForAction, railForAction, ROLE_TONES, ROLE_SHORT } from "./log-theme";

type FilterOptions = {
  actors: { id: string; name: string; email: string; role: UserRole }[];
  families: string[];
  actions: string[];
};

const PAGE_SIZE = 60;

export function LogTerminal() {
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [live, setLive] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: filters } = useQuery({
    queryKey: ["audit-filters"],
    queryFn: () => api.get<FilterOptions>("/api/admin/audit-logs?filters=true"),
    staleTime: 60_000,
  });

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["audit-logs", search, userId, action, from, to, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (userId) params.set("userId", userId);
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return api.get<Paginated<AuditLogEntry>>(`/api/admin/audit-logs?${params.toString()}`);
    },
    // Live tail: only the first page auto-refreshes, so paging back through
    // history isn't yanked out from under you.
    refetchInterval: live && page === 1 ? 10_000 : false,
  });

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Activity Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Every action taken in the system, by whom, and when.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLive((v) => !v)}>
            {live ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {live ? "Pause live tail" : "Resume live tail"}
          </Button>
          <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="log-search">Search</Label>
          <Input
            id="log-search"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder="Name, email or text..."
          />
        </div>
        <div>
          <Label htmlFor="log-actor">Actor</Label>
          <Select id="log-actor" value={userId} onChange={(e) => resetPage(setUserId)(e.target.value)}>
            <option value="">Everyone</option>
            {filters?.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({ROLE_SHORT[a.role]})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="log-action">Action</Label>
          <Select id="log-action" value={action} onChange={(e) => resetPage(setAction)(e.target.value)}>
            <option value="">All activity</option>
            {filters?.families.map((f) => (
              <option key={f} value={f}>
                {f} (all)
              </option>
            ))}
            {filters?.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="log-from">From</Label>
          <Input
            id="log-from"
            type="date"
            value={from}
            onChange={(e) => resetPage(setFrom)(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="log-to">To</Label>
          <Input id="log-to" type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg">
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="ml-2 flex items-center gap-2 font-mono text-xs text-slate-400">
            <Terminal className="h-3.5 w-3.5" />
            lecbook — activity.log
            {data && <span className="text-slate-600">· {data.total} entries</span>}
          </div>
          {live && page === 1 && (
            <span className="ml-auto flex items-center gap-1.5 font-mono text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              live
            </span>
          )}
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-3 font-mono text-xs leading-relaxed">
          {!data ? (
            <p className="px-2 py-6 text-slate-500">Loading activity...</p>
          ) : data.items.length === 0 ? (
            <p className="px-2 py-6 text-slate-500">
              <span className="text-emerald-400">$</span> no entries match these filters
            </p>
          ) : (
            data.items.map((entry) => {
              const tone = toneForAction(entry.action);
              const isOpen = expanded === entry.id;
              return (
                <div key={entry.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : entry.id)}
                    className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-slate-900 ${railForAction(entry.action)}`}
                  >
                    {isOpen ? (
                      <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-700" />
                    )}
                    <span className="shrink-0 text-slate-500">
                      {dayjs(entry.createdAt).format("YYYY-MM-DD HH:mm:ss")}
                    </span>
                    <span className={`w-14 shrink-0 ${ROLE_TONES[entry.actorRole]}`}>
                      [{ROLE_SHORT[entry.actorRole]}]
                    </span>
                    <span className={`w-44 shrink-0 truncate ${tone.tag}`}>{tone.label}</span>
                    <span className="min-w-0 flex-1 text-slate-300">{entry.summary}</span>
                    {entry.impersonatedById && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1.5 text-amber-300">
                        view-as
                      </span>
                    )}
                  </button>

                  {isOpen && (
                    <dl className="mb-1 ml-7 grid gap-x-4 gap-y-0.5 border-l border-slate-800 pl-4 text-slate-500 sm:grid-cols-[110px_1fr]">
                      <dt className="text-slate-600">actor</dt>
                      <dd className="text-slate-400">
                        {entry.actorName} &lt;{entry.actorEmail || "n/a"}&gt;
                      </dd>
                      <dt className="text-slate-600">action</dt>
                      <dd className="text-slate-400">{entry.action}</dd>
                      <dt className="text-slate-600">entity</dt>
                      <dd className="text-slate-400">
                        {entry.entity}
                        {entry.entityId ? ` #${entry.entityId}` : ""}
                      </dd>
                      <dt className="text-slate-600">ip</dt>
                      <dd className="text-slate-400">{entry.ip || "unknown"}</dd>
                      <dt className="text-slate-600">agent</dt>
                      <dd className="break-all text-slate-400">{entry.userAgent || "unknown"}</dd>
                      {entry.metadata && (
                        <>
                          <dt className="text-slate-600">metadata</dt>
                          <dd className="break-all text-amber-200/70">
                            {JSON.stringify(entry.metadata)}
                          </dd>
                        </>
                      )}
                    </dl>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  );
}
