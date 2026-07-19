"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Json } from "@planevo/core/types/database.types";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { saveRecordContent } from "@/app/(workspace)/records/[recordId]/actions";
import { PlanevoEditor } from "@/features/editor/planevo-editor";
import type { PlanevoEditorInstance } from "@/features/editor/editor-types";
import { RecordPropertyField } from "./record-property-field";
import { RecordTitle } from "./record-title";

export type RecordSurfaceData = {
  recordId: string;
  databaseId: string;
  properties: DatabasePropertyRow[];
  values: Record<string, Json>;
  contentJson: unknown;
};

export function RecordSurface({
  variant,
  data,
}: {
  variant: "page" | "peek";
  data: RecordSurfaceData;
}) {
  const { recordId, properties, values, contentJson } = data;
  const primary = properties.find((property) => property.is_primary);
  const title =
    primary && values[primary.id] !== undefined
      ? propertyValueToString(values[primary.id])
      : "Untitled";
  const secondaryProperties = properties.filter((property) => !property.is_primary);

  const editorRef = useRef<PlanevoEditorInstance | null>(null);
  const saveHandler = useCallback(
    (content: unknown) => saveRecordContent(recordId, content),
    [recordId],
  );

  useEffect(() => {
    return () => {
      const editor = editorRef.current;
      if (!editor) return;
      void saveRecordContent(recordId, editor.document);
    };
  }, [recordId]);

  const padding =
    variant === "page"
      ? "mx-auto min-h-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12"
      : "px-5 py-6 sm:px-8";

  return (
    <div className={padding}>
      <RecordTitle
        recordId={recordId}
        propertyId={primary?.id ?? ""}
        initialTitle={title || "Untitled"}
      />

      {secondaryProperties.length > 0 && (
        <dl className="mt-6 flex flex-col gap-3 border-b border-border pb-6">
          {secondaryProperties.map((property) => (
            <RecordPropertyField
              key={property.id}
              recordId={recordId}
              property={property}
              value={values[property.id]}
            />
          ))}
        </dl>
      )}

      <div className="mt-6">
        <PlanevoEditor
          initialContent={contentJson}
          onSave={saveHandler}
          toolbar={({ editor }) => {
            editorRef.current = editor;
            return null;
          }}
        />
      </div>
    </div>
  );
}
