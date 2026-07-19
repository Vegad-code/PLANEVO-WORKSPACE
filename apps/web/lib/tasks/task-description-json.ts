import { classifyTaskIcon } from "@planevo/core/tasks/task-icon-classifier";

export type DescriptionJsonFields = {
  title: string;
  description?: string;
  tags?: string[];
  estimateMinutes?: number | null;
};

export function buildDescriptionJson(
  fields: DescriptionJsonFields,
): Record<string, unknown> {
  const descriptionJson: Record<string, unknown> = {};

  if (fields.description?.trim()) {
    descriptionJson.text = fields.description.trim();
  }
  if (fields.tags?.length) {
    descriptionJson.tags = fields.tags;
  }
  if (fields.estimateMinutes != null && fields.estimateMinutes > 0) {
    descriptionJson.estimateMinutes = fields.estimateMinutes;
  }

  descriptionJson.icon = classifyTaskIcon({
    title: fields.title,
    tags: fields.tags,
    description: fields.description,
  });

  return descriptionJson;
}
