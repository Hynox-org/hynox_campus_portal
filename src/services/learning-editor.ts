import { createClient } from "@/utils/supabase/server";
import { validateInstitutionId } from "@/lib/institution-validation";
import type { Row } from "@/types/database-rows";

export async function requireActivityEditor(activityId: string) {
  validateInstitutionId(activityId);
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("can_edit_activity", { p_activity_id: activityId });
  if (error) throw error;
  if (data !== true) throw new Error("Access denied.");
}

export async function saveActivity(id: string | null, input: object): Promise<Row<"learning.activities">> {
  if (id) validateInstitutionId(id);
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("save_activity", { p_id: id, p_input: input });
  if (error) throw error;
  if (!data || typeof data.id !== "string" || typeof data.lesson_id !== "string" || typeof data.title !== "string") throw new Error("Activity save was not confirmed.");
  return data;
}

export async function assignActivity(input: object): Promise<Row<"learning.activity_assignments">> {
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("assign_activity", { p_input: input });
  if (error) throw error;
  if (!data || typeof data.id !== "string" || typeof data.cohort_id !== "string") throw new Error("Activity assignment was not confirmed.");
  return data;
}
