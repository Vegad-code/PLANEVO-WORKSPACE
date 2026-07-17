"use server";

import { revalidatePath } from "next/cache";
import {
  normalizeViewConfig,
  pruneViewConfig,
  type ViewConfig,
} from "@planevo/core/views/view-config";
import {
  needsRebalance,
  positionBetween,
  rebalanced,
} from "@planevo/core/ordering/fractional";
import type { Json } from "@planevo/core/types/database.types";
import { requireDataAccess } from "@/lib/data/access";
import type { DataAccess } from "@/lib/data/access";

const VIEW_TYPES = ["table", "board", "calendar", "list"] as const;
type ViewType = (typeof VIEW_TYPES)[number];

async function requireOwnedDatabase(databaseId: string): Promise<DataAccess> {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("databases")
    .select("id, workspaces!inner(owner_id)")
    .eq("id", databaseId)
    .eq("workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Database not found.");
  return access;
}

async function requireOwnedView(
  databaseId: string,
  viewId: string,
): Promise<{ access: DataAccess; view: { id: string; database_id: string; type: string; name: string; config_json: Json; position: number; is_default: boolean } }> {
  const access = await requireOwnedDatabase(databaseId);
  const { data, error } = await access.client
    .from("views")
    .select("id, database_id, type, name, config_json, position, is_default")
    .eq("id", viewId)
    .eq("database_id", databaseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("View not found.");
  return { access, view: data };
}

function defaultViewName(type: ViewType): string {
  switch (type) {
    case "table":
      return "Table";
    case "board":
      return "Board";
    case "list":
      return "List";
    case "calendar":
      return "Calendar";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function isViewType(value: string): value is ViewType {
  return (VIEW_TYPES as readonly string[]).includes(value);
}

function revalidateDatabase(databaseId: string): void {
  revalidatePath(`/databases/${databaseId}`);
  revalidatePath("/", "layout");
}

async function loadPropertyIds(access: DataAccess, databaseId: string): Promise<Set<string>> {
  const { data, error } = await access.client
    .from("database_properties")
    .select("id")
    .eq("database_id", databaseId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
}

function validatedConfig(config: ViewConfig, propertyIds: Set<string>): ViewConfig {
  return pruneViewConfig(normalizeViewConfig(config), propertyIds);
}

export async function createView(input: {
  databaseId: string;
  type: string;
  name?: string;
}): Promise<{ ok: boolean; viewId?: string; error?: string }> {
  try {
    if (!isViewType(input.type)) {
      return { ok: false, error: "That view type isn't available." };
    }
    const access = await requireOwnedDatabase(input.databaseId);
    const { data: siblings, error: siblingsError } = await access.client
      .from("views")
      .select("position")
      .eq("database_id", input.databaseId)
      .order("position", { ascending: false })
      .limit(1);
    if (siblingsError) throw siblingsError;

    const position = (siblings?.[0]?.position ?? -1) + 1;
    const isFirst = !siblings || siblings.length === 0;
    const name = input.name?.trim() || defaultViewName(input.type);

    const { data, error } = await access.client
      .from("views")
      .insert({
        database_id: input.databaseId,
        type: input.type,
        name,
        config_json: {},
        position,
        is_default: isFirst,
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidateDatabase(input.databaseId);
    return { ok: true, viewId: data.id };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to create the view.",
    };
  }
}

export async function renameView(input: {
  databaseId: string;
  viewId: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "View name is required." };

  try {
    const { access } = await requireOwnedView(input.databaseId, input.viewId);
    const { error } = await access.client
      .from("views")
      .update({ name })
      .eq("id", input.viewId)
      .eq("database_id", input.databaseId);
    if (error) throw error;
    revalidateDatabase(input.databaseId);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to rename the view.",
    };
  }
}

export async function duplicateView(input: {
  databaseId: string;
  viewId: string;
}): Promise<{ ok: boolean; viewId?: string; error?: string }> {
  try {
    const { access, view } = await requireOwnedView(input.databaseId, input.viewId);
    const { data: siblings, error: siblingsError } = await access.client
      .from("views")
      .select("position")
      .eq("database_id", input.databaseId)
      .order("position", { ascending: false })
      .limit(1);
    if (siblingsError) throw siblingsError;

    const position = (siblings?.[0]?.position ?? -1) + 1;
    const { data, error } = await access.client
      .from("views")
      .insert({
        database_id: input.databaseId,
        type: view.type,
        name: `${view.name} copy`,
        config_json: view.config_json,
        position,
        is_default: false,
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidateDatabase(input.databaseId);
    return { ok: true, viewId: data.id };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to duplicate the view.",
    };
  }
}

export async function changeViewType(input: {
  databaseId: string;
  viewId: string;
  type: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isViewType(input.type)) {
    return { ok: false, error: "That view type isn't available." };
  }

  try {
    const { access } = await requireOwnedView(input.databaseId, input.viewId);
    const { error } = await access.client
      .from("views")
      .update({ type: input.type })
      .eq("id", input.viewId)
      .eq("database_id", input.databaseId);
    if (error) throw error;
    revalidateDatabase(input.databaseId);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to change the view type.",
    };
  }
}

export async function setDefaultView(input: {
  databaseId: string;
  viewId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { access } = await requireOwnedView(input.databaseId, input.viewId);
    const { error: clearError } = await access.client
      .from("views")
      .update({ is_default: false })
      .eq("database_id", input.databaseId);
    if (clearError) throw clearError;

    const { error } = await access.client
      .from("views")
      .update({ is_default: true })
      .eq("id", input.viewId)
      .eq("database_id", input.databaseId);
    if (error) throw error;

    revalidateDatabase(input.databaseId);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to set the default view.",
    };
  }
}

export async function deleteView(input: {
  databaseId: string;
  viewId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { count, error: countError } = await access.client
      .from("views")
      .select("id", { count: "exact", head: true })
      .eq("database_id", input.databaseId);
    if (countError) throw countError;
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "A database needs at least one view." };
    }

    const { data: target, error: targetError } = await access.client
      .from("views")
      .select("id, is_default")
      .eq("id", input.viewId)
      .eq("database_id", input.databaseId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return { ok: false, error: "View not found." };

    const { error } = await access.client
      .from("views")
      .delete()
      .eq("id", input.viewId)
      .eq("database_id", input.databaseId);
    if (error) throw error;

    if (target.is_default) {
      const { data: nextDefault, error: nextError } = await access.client
        .from("views")
        .select("id")
        .eq("database_id", input.databaseId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nextError) throw nextError;
      if (nextDefault) {
        await access.client
          .from("views")
          .update({ is_default: true })
          .eq("id", nextDefault.id);
      }
    }

    revalidateDatabase(input.databaseId);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to delete the view.",
    };
  }
}

export async function saveViewConfig(input: {
  databaseId: string;
  viewId: string;
  config: ViewConfig;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { access } = await requireOwnedView(input.databaseId, input.viewId);
    const propertyIds = await loadPropertyIds(access, input.databaseId);
    const config = validatedConfig(input.config, propertyIds);

    const { error } = await access.client
      .from("views")
      .update({ config_json: config as unknown as Json })
      .eq("id", input.viewId)
      .eq("database_id", input.databaseId);
    if (error) throw error;

    revalidateDatabase(input.databaseId);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to save the view.",
    };
  }
}

export async function reorderView(input: {
  databaseId: string;
  viewId: string;
  beforeViewId: string | null;
  afterViewId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { data: siblings, error: siblingsError } = await access.client
      .from("views")
      .select("id, position")
      .eq("database_id", input.databaseId)
      .order("position", { ascending: true });
    if (siblingsError) throw siblingsError;
    if (!siblings?.length) return { ok: false, error: "No views to reorder." };

    const before = input.beforeViewId
      ? siblings.find((row) => row.id === input.beforeViewId)?.position ?? null
      : null;
    const after = input.afterViewId
      ? siblings.find((row) => row.id === input.afterViewId)?.position ?? null
      : null;

    if (needsRebalance(before, after)) {
      const positions = rebalanced(siblings.length);
      for (let i = 0; i < siblings.length; i += 1) {
        const { error } = await access.client
          .from("views")
          .update({ position: positions[i] })
          .eq("id", siblings[i]!.id);
        if (error) throw error;
      }
    }

    const refreshed = needsRebalance(before, after)
      ? (
          await access.client
            .from("views")
            .select("id, position")
            .eq("database_id", input.databaseId)
            .order("position", { ascending: true })
        ).data ?? []
      : siblings;

    const refreshedBefore = input.beforeViewId
      ? refreshed.find((row) => row.id === input.beforeViewId)?.position ?? null
      : null;
    const refreshedAfter = input.afterViewId
      ? refreshed.find((row) => row.id === input.afterViewId)?.position ?? null
      : null;

    const position = positionBetween(refreshedBefore, refreshedAfter);
    const { error } = await access.client
      .from("views")
      .update({ position })
      .eq("id", input.viewId)
      .eq("database_id", input.databaseId);
    if (error) throw error;

    revalidateDatabase(input.databaseId);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to reorder the view.",
    };
  }
}
